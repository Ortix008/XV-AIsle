import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { holdState } from "@/lib/server/fees";
import { payoutHold } from "@/lib/server/ledger";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { ordersVisibleTo } from "@/lib/server/store";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
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
    payoutNote: payoutHold(order),
  }));
  return Response.json({ orders });
}
