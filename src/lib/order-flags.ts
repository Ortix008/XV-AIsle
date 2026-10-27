export const BLOCKED_TEST_ORDER_NUMBER = "XV-1001";
export const STOCK_REVIEW_FLAG = "review";
export const STOCK_REVIEW_NOTE =
  "Review this order before it ships. Payment came in after the stock hold, and the shelf could not cover it.";

export function stockReviewNote(flag: string | null | undefined) {
  return flag === STOCK_REVIEW_FLAG ? STOCK_REVIEW_NOTE : null;
}
export const PLACE_REMIND_MS = 24 * 60 * 60 * 1000;
export const TRACKING_STALE_MS = 3 * 24 * 60 * 60 * 1000;

export type ListingRoute = "manual" | "email" | "api";

export function isBlockedTestOrder(number: string) {
  return number === BLOCKED_TEST_ORDER_NUMBER;
}

export function parseListingRoute(value: string | null | undefined): ListingRoute {
  switch (value) {
    case "manual":
    case "email":
    case "api":
      return value;
    default:
      return "manual";
  }
}

export function cleanSupplierOrderUrl(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length > 300) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function cleanSupplierEmail(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 120 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed)) return null;
  return trimmed;
}

export function placingIsOverdue(
  order: { status: string; number: string; paidAt: number | null; createdAt: number },
  now: number,
) {
  if (order.status !== "needs_placing" || isBlockedTestOrder(order.number)) return false;
  return now - (order.paidAt ?? order.createdAt) >= PLACE_REMIND_MS;
}

/** Shipped orders whose admin tracking save is 3 days old or older. */
export function trackingIsStale(
  order: {
    status: string;
    shippedAt: number | null;
    deliveredAt: number | null;
    trackingUpdatedAt: number | null;
  },
  now: number,
) {
  if (order.deliveredAt || order.status === "delivered" || order.status === "refunded") return false;
  const shipped = order.status === "shipped" || order.shippedAt != null;
  if (!shipped || !order.trackingUpdatedAt) return false;
  return now - order.trackingUpdatedAt >= TRACKING_STALE_MS;
}
