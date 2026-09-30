import { cookies } from "next/headers";
import { accountFromToken, clearMembership } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { cancelSubscription } from "@/lib/server/stripe";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const subscriptionId = clearMembership(account.id);
  if (subscriptionId) await cancelSubscription(subscriptionId);
  return Response.json({ ok: true });
}
