import type { Actor } from "./access";
import { adminWithTotp, deliverDecision } from "./access";
import { approvePayout, markDelivered } from "./ledger";
import { acceptDelayRefund, sendDelayNotice } from "./order-routing";
import { markShipped, placeSupplierOrder } from "./store";

export async function deliverFor(
  account: Actor | null,
  orderId: string,
  shipment?: { carrier?: string; tracking?: string },
) {
  const decision = deliverDecision(account);
  if (decision) return decision;
  if (shipment?.carrier || shipment?.tracking) {
    const shipped = markShipped(orderId, shipment.carrier ?? "", shipment.tracking ?? "", { byAdmin: true });
    if ("error" in shipped) return { status: 400 as const, error: shipped.error };
  }
  const result = await markDelivered(orderId);
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order, released: result.released };
}

export function placeFor(
  account: Actor | null,
  orderId: string,
  input: { supplierRef?: string; supplierCostCents?: number },
) {
  const decision = adminWithTotp(account);
  if (decision) return decision;
  const result = placeSupplierOrder(orderId, {
    supplierRef: input.supplierRef ?? "",
    supplierCostCents: input.supplierCostCents ?? -1,
  });
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order };
}

export function shipFor(account: Actor | null, orderId: string, input: { carrier?: string; tracking?: string }) {
  const decision = deliverDecision(account);
  if (decision) return decision;
  const result = markShipped(orderId, input.carrier ?? "", input.tracking ?? "", { byAdmin: true });
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order };
}

export async function delayFor(account: Actor | null, orderId: string, expectedOn: string) {
  const decision = adminWithTotp(account);
  if (decision) return decision;
  const result = await sendDelayNotice(orderId, expectedOn);
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order, mailed: result.mailed };
}

export async function delayRefundFor(token: string) {
  return acceptDelayRefund(token);
}

export async function approveFor(account: Actor | null, orderId: string) {
  const decision = adminWithTotp(account);
  if (decision) return decision;
  const result = await approvePayout(orderId);
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, order: result.order, released: result.released };
}
