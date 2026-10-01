import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { settleCheckoutSession } from "@/lib/server/ledger";
import { retrieveCheckoutSession, stripeConfigured } from "@/lib/server/stripe";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (!stripeConfigured()) return Response.json({ error: "Stripe is not configured." }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { sessionId?: string } | null;
  if (!body?.sessionId) return Response.json({ error: "Missing checkout." }, { status: 400 });
  try {
    const session = await retrieveCheckoutSession(body.sessionId);
    if (session.metadata?.account_id !== account.id) {
      return Response.json({ error: "That checkout belongs to another account." }, { status: 403 });
    }
    const settled = await settleCheckoutSession(session);
    return Response.json(settled);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be confirmed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
