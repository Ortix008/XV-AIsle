import { cookies } from "next/headers";
import { accountFromToken, readPayout, billingConfigured } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ account: null, payout: null, billing: billingConfigured() });
  return Response.json({
    account,
    payout: readPayout(account.id),
    billing: billingConfigured(),
  });
}
