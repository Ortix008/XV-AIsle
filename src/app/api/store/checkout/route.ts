import { compareAtRejection } from "@/lib/honest-price";
import { referralFromCookieHeader } from "@/lib/referral";
import { attachReferrer } from "@/lib/server/money-flow";
import { allowClient } from "@/lib/server/rate-limit";
import { settleCheckoutSession } from "@/lib/server/ledger";
import { orderSummary } from "@/lib/server/order-summary";
import { buyerOrder } from "@/lib/server/order-view";
import { demoSeedEnabled } from "@/lib/server/starter-shelf";
import { attachStripeSession, createPendingOrder, orderByStripeSession } from "@/lib/server/store";
import { createCheckoutSession, retrieveCheckoutSession, stripeConfigured } from "@/lib/server/stripe";

const PREVIEW_SESSION = /^cs_preview_[a-z0-9_]{1,80}$/;
const STRIPE_WAIT_MS = 4000;

function checkoutJson(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function paidBody(order: NonNullable<ReturnType<typeof orderByStripeSession>>) {
  return checkoutJson({ kind: "order", order: buyerOrder(order), summary: orderSummary(order) });
}

/** A paid row already on file. Preview sessions still require DEMO_SEED. */
function paidOnFile(sessionId: string) {
  if (PREVIEW_SESSION.test(sessionId) && !demoSeedEnabled()) return null;
  const order = orderByStripeSession(sessionId);
  if (!order || order.status === "pending" || order.status === "test") return null;
  return order;
}

function retrieveWithTimeout(sessionId: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const pending = retrieveCheckoutSession(sessionId);
  void pending.catch(() => undefined);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Stripe did not answer.")), STRIPE_WAIT_MS);
    timer.unref();
  });
  return Promise.race([pending, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return checkoutJson({ error: "Missing checkout." }, 400);
  const recorded = paidOnFile(sessionId);
  if (recorded) return paidBody(recorded);
  if (!stripeConfigured()) {
    return checkoutJson({ error: "Stripe is not configured." }, 503);
  }
  try {
    const session = await retrieveWithTimeout(sessionId);
    if (session.metadata?.kind !== "order") {
      return checkoutJson({ error: "That checkout is not a store order." }, 400);
    }
    const settled = await settleCheckoutSession(session);
    if ("order" in settled && settled.order) {
      return checkoutJson({ ...settled, order: buyerOrder(settled.order), summary: orderSummary(settled.order) });
    }
    const paidAfter = paidOnFile(sessionId);
    if (paidAfter) return paidBody(paidAfter);
    if ("error" in settled && settled.error === "Payment is not complete.") {
      return checkoutJson({ pending: true }, 202);
    }
    return checkoutJson(settled);
  } catch {
    const paidAfter = paidOnFile(sessionId);
    if (paidAfter) return paidBody(paidAfter);
    return checkoutJson({ pending: true }, 202);
  }
}

export async function POST(request: Request) {
  if (!allowClient(request, "checkout", 8, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many checkout tries. Wait a few minutes." }, { status: 429 });
  }
  if (!stripeConfigured()) {
    console.error("Card checkout refused because STRIPE_SECRET_KEY is unset.");
    return Response.json({ error: "Card checkout isn't open yet." }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    qty?: number;
    variantId?: string;
    name?: string;
    email?: string;
    line1?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  } | null;
  if (!body?.productId) return Response.json({ error: "Choose a product." }, { status: 400 });
  const compareAt = compareAtRejection(body);
  if (compareAt) return Response.json({ error: compareAt }, { status: 400 });
  const created = createPendingOrder({
    productId: body.productId,
    qty: body.qty ?? 1,
    variantId: typeof body.variantId === "string" ? body.variantId : null,
    ship: {
      name: body.name ?? "",
      email: body.email ?? "",
      line1: body.line1 ?? "",
      city: body.city ?? "",
      region: body.region ?? "",
      postal: body.postal ?? "",
      country: body.country ?? "US",
    },
  });
  if ("error" in created) return Response.json({ error: created.error }, { status: 400 });
  attachReferrer(created.order.id, referralFromCookieHeader(request.headers.get("cookie")));
  try {
    const session = await createCheckoutSession({
      kind: "order",
      accountId: created.order.accountId,
      orderId: created.order.id,
      transferGroup: created.order.transferGroup ?? undefined,
      name: created.listing.title,
      amountCents: created.listing.priceCents,
      quantity: created.order.qty,
      customerEmail: created.order.email,
      successPath: `/shop/return?token=${encodeURIComponent(created.receiptToken)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelPath: `/shop/${created.listing.productId}?canceled=${encodeURIComponent(created.order.id)}`,
    });
    if (!session.url || !session.id) {
      return Response.json({ error: "Stripe did not return a checkout page." }, { status: 502 });
    }
    attachStripeSession(created.order.id, session.id);
    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout did not open.";
    return Response.json({ error: message }, { status: 502 });
  }
}
