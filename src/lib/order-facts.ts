/** Shopper-facing ship copy. A window is confirmed only when both day counts are set. */
export const UNCONFIRMED_SHIP = "Ships from a US supplier. Tracking emailed when it ships.";

export function shipDaysConfirmed(min?: number | null, max?: number | null) {
  return (min ?? 0) > 0 && (max ?? 0) > 0;
}

/** Receipt and order pages. A hyphen, and a single number when the two days match. */
export function receiptShipWindow(min?: number | null, max?: number | null) {
  if (!shipDaysConfirmed(min, max)) return UNCONFIRMED_SHIP;
  const lo = min ?? 0;
  const hi = max ?? 0;
  const span = lo === hi ? String(lo) : `${lo}-${hi}`;
  return `Usually ships in ${span} business days.`;
}

/** Product page. An en dash, and a single number when the two days match. */
export function productShipLine(listing: { supplierName: string; shipDaysMin?: number | null; shipDaysMax?: number | null }) {
  if (!shipDaysConfirmed(listing.shipDaysMin, listing.shipDaysMax)) return UNCONFIRMED_SHIP;
  const lo = listing.shipDaysMin ?? 0;
  const hi = listing.shipDaysMax ?? 0;
  const span = lo === hi ? String(lo) : `${lo}–${hi}`;
  return `${listing.supplierName} ships it to you. Our best estimate is ${span} days after you pay.`;
}

/** Arrival copy for an order. Confirmed days use the receipt window. Anything else uses the unconfirmed line. */
export function etaFromListing(
  listing: { deliveryTime?: string | null; shipDaysMin?: number | null; shipDaysMax?: number | null } | null | undefined,
) {
  return receiptShipWindow(listing?.shipDaysMin, listing?.shipDaysMax);
}
