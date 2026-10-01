import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { holdState } from "@/lib/server/fees";
import { payoutHold, releaseMatured } from "@/lib/server/ledger";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { flagRefundDeadlines, listHoldAlerts, ordersVisibleTo, sweepStuckFulfillment } from "@/lib/server/store";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  await sweepStuckFulfillment();
  flagRefundDeadlines();
  await releaseMatured();
  const orders = ordersVisibleTo(account).map((order) => ({
    id: order.id,
    number: order.number,
    title: order.title,
    status: order.status,
    supplierDetail: order.supplierDetail,
    deliveredAt: order.deliveredAt,
    paidAt: order.paidAt,
    riskLevel: order.riskLevel,
    reviewOpen: order.reviewOpen,
    reviewClosed: order.reviewClosed,
    disputeOpen: order.disputeOpen,
    riskApproved: order.riskApproved,
    hold: holdState(order.paidAt),
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    buyerConfirmedAt: order.buyerConfirmedAt,
    buyerDisputeOpen: order.buyerDisputeOpen,
    refundRequired: order.refundRequired,
    fulfillmentFlag: order.fulfillmentFlag,
    payoutNote: payoutHold(order),
  }));
  const alerts = account.role === "admin" && account.emailVerified ? listHoldAlerts() : [];
  return Response.json({ orders, alerts });
}
