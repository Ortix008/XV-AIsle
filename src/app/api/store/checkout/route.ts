import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { attachStripeSession, createPendingOrder, getOrder, settleCheckoutSession } from "@/lib/server/store";
import { createCheckoutSession, retrieveCheckoutSession, stripeConfigured } from "@/lib/server/stripe";

export async function GET(request: Request) {
  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return Response.json({ error: "Missing checkout." }, { status: 400 });
  if (!stripeConfigured()) {
    return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  }
  try {
    const session = await retrieveCheckoutSession(sessionId);
    if (session.metadata?.kind !== "order") {
      return Response.json({ error: "That checkout is not a store order." }, { status: 400 });
    }
    const settled = await settleCheckoutSession(session);
    return Response.json(settled);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be confirmed.";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "checkout"), 8, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many checkout tries. Wait a few minutes." }, { status: 429 });
  }
  if (!stripeConfigured()) {
    return Response.json(
      { error: "Card checkout is not connected. Set STRIPE_SECRET_KEY before the store can take payment." },
      { status: 503 },
    );
  }
  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    qty?: number;
    name?: string;
    email?: string;
    line1?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  } | null;
  if (!body?.productId) return Response.json({ error: "Choose a product." }, { status: 400 });
  const created = createPendingOrder({
    productId: body.productId,
    qty: body.qty ?? 1,
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
  try {
    const session = await createCheckoutSession({
      kind: "order",
      accountId: created.order.accountId,
      orderId: created.order.id,
      name: created.listing.title,
      amountCents: created.listing.priceCents,
      quantity: created.order.qty,
      customerEmail: created.order.email,
      successPath: "/shop/return?session_id={CHECKOUT_SESSION_ID}",
      cancelPath: `/shop/${created.listing.productId}`,
    });
    if (!session.url || !session.id) {
      return Response.json({ error: "Stripe did not return a checkout page." }, { status: 502 });
    }
    attachStripeSession(created.order.id, session.id);
    return Response.json({ url: session.url, order: getOrder(created.order.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout did not open.";
    return Response.json({ error: message }, { status: 502 });
  }
}
