import { verifyStripeSignature } from "./stripe";
import { getOrder } from "./store";
import { markDelivered } from "./ledger";

export async function acceptSupplierDelivery(raw: string, header: string | null) {
  const secret = process.env.SUPPLIER_CALLBACK_SECRET?.trim();
  if (!secret) return { status: 503 as const, error: "Supplier callback secret is not set." };
  if (!verifyStripeSignature(raw, header, secret)) {
    return { status: 400 as const, error: "Supplier signature did not match." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { status: 400 as const, error: "The delivery note was not readable." };
  }
  if (!parsed || typeof parsed !== "object") return { status: 400 as const, error: "The delivery note was not readable." };
  const body = parsed as { orderId?: unknown; supplierAccountId?: unknown };
  if (typeof body.orderId !== "string" || typeof body.supplierAccountId !== "string") {
    return { status: 400 as const, error: "Name the order and the supplier account." };
  }
  const order = getOrder(body.orderId);
  if (!order) return { status: 404 as const, error: "That order is not on file." };
  if (order.supplierAccountId !== body.supplierAccountId) {
    return { status: 403 as const, error: "That supplier does not own this order." };
  }
  const result = await markDelivered(order.id);
  if ("error" in result && result.error) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order ?? null };
}
