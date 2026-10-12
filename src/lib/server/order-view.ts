import { isBlockedTestOrder, placingIsOverdue, trackingIsStale } from "../order-flags";
import { publicShopListing, type StoreListing, type StoreOrder } from "./store";

function omitKeys<T extends object, K extends keyof T>(value: T, keys: readonly K[]): Omit<T, K> {
  const next: Partial<T> = { ...value };
  for (const key of keys) delete next[key];
  return next as Omit<T, K>;
}

export function publicListing(listing: StoreListing, sample = false) {
  return publicShopListing(listing, sample);
}

/** Reseller publish responses keep the cost quote and drop the supplier order link and email. */
export function resellerListing(listing: StoreListing) {
  return omitKeys(listing, [
    "supplierOrderUrl",
    "supplierEmail",
    "returnLine1",
    "returnCity",
    "returnRegion",
    "returnPostal",
    "returnCountry",
  ]);
}

/** Buyer and supplier payloads never include what we paid the supplier. */
export function buyerOrder(order: StoreOrder) {
  return omitKeys(order, ["supplierPaidCents"]);
}

export function presentOrder(
  account: { role: string },
  order: StoreOrder,
  listing: Pick<StoreListing, "supplierOrderUrl" | "supplierEmail" | "route"> | null,
  now = Date.now(),
) {
  const base = {
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
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    buyerConfirmedAt: order.buyerConfirmedAt,
    buyerDisputeOpen: order.buyerDisputeOpen,
    refundRequired: order.refundRequired,
    fulfillmentFlag: order.fulfillmentFlag,
  };
  if (account.role !== "admin") return base;
  const blocked = isBlockedTestOrder(order.number) || order.status === "test";
  return {
    ...base,
    supplierRef: order.supplierRef,
    supplierPaidCents: order.supplierPaidCents,
    supplierOrderUrl: blocked ? null : (listing?.supplierOrderUrl ?? null),
    supplierEmail: blocked ? null : (listing?.supplierEmail ?? null),
    route: blocked ? null : (listing?.route ?? "manual"),
    placingOverdue: placingIsOverdue(order, now),
    delayFlagged: Boolean(order.delayFlaggedAt) && !order.shippedAt && !order.deliveredAt && order.status !== "refunded",
    delayExpectedOn: order.delayExpectedOn,
    delayNoticeSentAt: order.delayNoticeSentAt,
    delayRefundRequestedAt: order.delayRefundRequestedAt,
    delayRefundDueAt: order.delayRefundDueAt,
    delayRefundedAt: order.delayRefundedAt,
    trackingStale: trackingIsStale(order, now),
  };
}

export function presentDelay(order: StoreOrder) {
  return {
    number: order.number,
    title: order.title ?? "Order",
    expectedOn: order.delayExpectedOn,
    refundRequestedAt: order.delayRefundRequestedAt,
    refundDueAt: order.delayRefundDueAt,
    refundedAt: order.delayRefundedAt,
  };
}
