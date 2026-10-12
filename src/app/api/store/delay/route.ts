import { delayRefundFor } from "@/lib/server/order-actions";
import { presentDelay } from "@/lib/server/order-view";
import { orderByDelayToken } from "@/lib/server/store";

export function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const order = orderByDelayToken(token);
  if (!order) return Response.json({ error: "That refund link does not match an order." }, { status: 404 });
  return Response.json({ order: presentDelay(order) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: string } | null;
  const result = await delayRefundFor(body?.token ?? "");
  if ("error" in result) {
    const order = "order" in result && result.order ? presentDelay(result.order) : undefined;
    return Response.json(order ? { error: result.error, order } : { error: result.error }, { status: result.status });
  }
  return Response.json({ order: presentDelay(result.order), refunded: result.refunded });
}
