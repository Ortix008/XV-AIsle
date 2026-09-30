import type { Actor } from "./access";
import { deliverDecision } from "./access";
import { approvePayout, markDelivered } from "./ledger";
import { markShipped } from "./store";

export async function deliverFor(
  account: Actor | null,
  orderId: string,
  shipment?: { carrier?: string; tracking?: string },
) {
  const decision = deliverDecision(account);
  if (decision) return decision;
  if (shipment?.carrier || shipment?.tracking) {
    const shipped = markShipped(orderId, shipment.carrier ?? "", shipment.tracking ?? "");
    if ("error" in shipped) return { status: 400 as const, error: shipped.error };
  }
  const result = await markDelivered(orderId);
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order, released: result.released };
}

export async function approveFor(account: Actor | null, orderId: string) {
  const decision = deliverDecision(account);
  if (decision) return decision;
  const result = await approvePayout(orderId);
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order, released: result.released };
}
