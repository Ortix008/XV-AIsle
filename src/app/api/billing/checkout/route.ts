import { cookies } from "next/headers";
import { MEMBER_PRICE } from "@/lib/account";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { createCheckoutSession, stripeConfigured } from "@/lib/server/stripe";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!stripeConfigured()) {
    return Response.json(
      { error: "Membership billing is not connected. Set STRIPE_SECRET_KEY before this can charge." },
      { status: 503 },
    );
  }
  try {
    const session = await createCheckoutSession({
      kind: "membership",
      accountId: account.id,
      name: "XVAIsle membership",
      amountCents: MEMBER_PRICE * 100,
      customerEmail: account.email,
      successPath: "/membership?checkout=return&session_id={CHECKOUT_SESSION_ID}",
      cancelPath: "/membership",
    });
    if (!session.url) return Response.json({ error: "Stripe did not return a checkout page." }, { status: 502 });
    return Response.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout did not open.";
    return Response.json({ error: message }, { status: 502 });
  }
}
