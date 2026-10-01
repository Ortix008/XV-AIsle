import { cookies } from "next/headers";
import { accountFromToken, billingConfigured } from "@/lib/server/accounts";
import { getConnected } from "@/lib/server/connect";
import { resellerReserveSummary } from "@/lib/server/ledger";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ account: null, connect: null, billing: billingConfigured() });
  const connect = getConnected(account.id);
  return Response.json({
    account,
    connect: connect
      ? {
          stripeAccountId: connect.stripeAccountId,
          payoutsEnabled: connect.payoutsEnabled,
          chargesEnabled: connect.chargesEnabled,
          detailsSubmitted: connect.detailsSubmitted,
          requirementsDue: connect.requirementsDue,
          transfersStatus: connect.transfersStatus,
        }
      : null,
    billing: billingConfigured(),
    reserve: resellerReserveSummary(account.id),
  });
}
