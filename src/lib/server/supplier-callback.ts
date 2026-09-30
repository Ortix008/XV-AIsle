import { markDelivered } from "./ledger";
import { supplierSecretMatches } from "./supplier-secret";
import { getOrder, markShipped } from "./store";

export async function acceptSupplierDelivery(raw: string, secretHeader: string | null) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { status: 400 as const, error: "The delivery note was not readable." };
  }
  if (!parsed || typeof parsed !== "object") return { status: 400 as const, error: "The delivery note was not readable." };
  const body = parsed as {
    orderId?: unknown;
    supplierAccountId?: unknown;
    carrier?: unknown;
    tracking?: unknown;
    delivered?: unknown;
  };
  if (typeof body.orderId !== "string" || typeof body.supplierAccountId !== "string") {
    return { status: 400 as const, error: "Name the order and the supplier account." };
  }
  if (typeof body.carrier !== "string" || typeof body.tracking !== "string") {
    return { status: 400 as const, error: "Add a carrier and a tracking number." };
  }
  if (!supplierSecretMatches(body.supplierAccountId, secretHeader)) {
    return { status: 403 as const, error: "Supplier secret did not match." };
  }
  const order = getOrder(body.orderId);
  if (!order) return { status: 404 as const, error: "That order is not on file." };
  if (order.supplierAccountId !== body.supplierAccountId) {
    return { status: 403 as const, error: "That supplier does not own this order." };
  }
  const shipped = markShipped(order.id, body.carrier, body.tracking);
  if ("error" in shipped) return { status: 400 as const, error: shipped.error };
  if (body.delivered === true) {
    const result = await markDelivered(order.id);
    if ("error" in result && result.error) return { status: 400 as const, error: result.error };
    return { status: 200 as const, order: result.order ?? null };
  }
  return { status: 200 as const, order: shipped.order };
}
