import { settleCheckoutSession } from "@/lib/server/store";
import { retrieveCheckoutSession, verifyStripeSignature } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Stripe webhook secret is not set." }, { status: 503 });
  const raw = await request.text();
  const header = request.headers.get("stripe-signature");
  if (!verifyStripeSignature(raw, header, secret)) {
    return Response.json({ error: "Stripe signature did not match." }, { status: 400 });
  }
  let event: { type?: string; data?: { object?: { id?: string } } };
  try {
    event = JSON.parse(raw) as { type?: string; data?: { object?: { id?: string } } };
  } catch {
    return Response.json({ error: "Stripe did not send a readable event." }, { status: 400 });
  }
  if (event.type === "checkout.session.completed" && event.data?.object?.id) {
    const session = await retrieveCheckoutSession(event.data.object.id);
    await settleCheckoutSession(session);
  }
  return Response.json({ received: true });
}
