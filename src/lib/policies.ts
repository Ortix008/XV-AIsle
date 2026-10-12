/** Customer return window. Supplier contracts use 14 days. */
export const RETURN_WINDOW_DAYS = 14;

/** Required when a reseller mentions a product they can earn on. */
export const RESELLER_DISCLOSURE = "#ad, I earn a commission.";

/**
 * Reseller commission on a completed sale, in basis points.
 * 500 is 5%. The program page and the terms page both read this.
 */
export const RESELLER_COMMISSION_BPS = 500;

export function resellerCommissionLabel() {
  return `${RESELLER_COMMISSION_BPS / 100}%`;
}
