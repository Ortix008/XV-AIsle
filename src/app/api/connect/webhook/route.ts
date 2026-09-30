import { acceptStripeEvent } from "@/lib/server/stripe-events";

export async function POST(request: Request) {
  const raw = await request.text();
  const result = await acceptStripeEvent(
    raw,
    request.headers.get("stripe-signature"),
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  );
  return Response.json(result.body, { status: result.status });
}
