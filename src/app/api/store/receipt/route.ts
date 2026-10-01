import { confirmReceipt, disputeReceipt } from "@/lib/server/ledger";
import { orderByReceiptToken } from "@/lib/server/store";
import { BUYER_WINDOW_MS } from "@/lib/server/fees";

function publicReceipt(token: string) {
  const order = orderByReceiptToken(token);
  if (!order) return null;
  return {
    number: order.number,
    title: order.title ?? "Order",
    status: order.status,
    deliveredAt: order.deliveredAt,
    shippedAt: order.shippedAt,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    buyerConfirmedAt: order.buyerConfirmedAt,
    buyerDisputeOpen: order.buyerDisputeOpen && !order.buyerDisputeResolved,
    windowEndsAt: order.deliveredAt ? order.deliveredAt + BUYER_WINDOW_MS : null,
  };
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const order = publicReceipt(token);
  if (!order) return Response.json({ error: "That receipt link does not match an order." }, { status: 404 });
  return Response.json({ order });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    token?: string;
    action?: string;
    note?: string;
  } | null;
  if (!body?.token || (body.action !== "confirm" && body.action !== "dispute")) {
    return Response.json({ error: "Say whether this is a confirmation or a dispute." }, { status: 400 });
  }
  if (body.action === "confirm") {
    const result = await confirmReceipt(body.token);
    if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
    return Response.json({ order: publicReceipt(body.token) });
  }
  const result = await disputeReceipt(body.token, body.note ?? "");
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ order: publicReceipt(body.token) });
}
