import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { getConnected, refreshConnected } from "@/lib/server/connect";
import { appOrigin } from "@/lib/server/stripe";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const origin = appOrigin();
  if (account) {
    const row = getConnected(account.id);
    if (row) {
      try {
        await refreshConnected(row.stripeAccountId);
      } catch {
        return Response.redirect(`${origin}/membership?connect=retry`);
      }
    }
  }
  return Response.redirect(`${origin}/membership?connect=return`);
}
