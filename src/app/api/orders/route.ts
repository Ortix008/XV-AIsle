import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { holdState } from "@/lib/server/fees";
import { payoutHold, releaseMatured } from "@/lib/server/ledger";
import { flagShippingDelays, remindUnplacedOrders } from "@/lib/server/order-routing";
import { presentOrder } from "@/lib/server/order-view";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { flagRefundDeadlines, getListing, listHoldAlerts, ordersVisibleTo, sweepStuckFulfillment } from "@/lib/server/store";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  await sweepStuckFulfillment();
  flagRefundDeadlines();
  flagShippingDelays();
  await remindUnplacedOrders();
  await releaseMatured();
  const orders = ordersVisibleTo(account).map((order) => ({
    ...presentOrder(account, order, account.role === "admin" ? getListing(order.productId) : null),
    hold: holdState(order.paidAt),
    payoutNote: account.role === "admin" ? payoutHold(order) : null,
  }));
  const alerts = account.role === "admin" && account.emailVerified ? listHoldAlerts() : [];
  return Response.json({ orders, alerts });
}
