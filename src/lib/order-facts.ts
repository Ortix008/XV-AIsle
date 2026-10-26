/** Shopper-facing ship copy. A product window needs a confirmed supplier and both day counts. */

export const US_SUPPLIER_SHIP = "Ships from a US supplier. Tracking emailed when it ships.";
export const TRACKING_SHIP = "Tracking emailed when it ships.";
/** Place line a shopper may see. No city, no supplier name. */
export const SHOPPER_PLACE = "Ships from a US supplier.";

const ENGINE_SHIP_SENTENCE =
  /Ships from [^.\n]{0,240} through [^.\n]{0,240}\.(?:\s*Plan on [^.\n]{0,160} days\.)?(?:\s*This is an import, not a week-of order\.)?/g;

/** Exact catalog sentence removed from shopper copy and stored descriptions. */
export const ASSEMBLED_IN_USA_SENTENCE = "Designed and assembled in the USA.";

function tidyDescription(value: string) {
  return value
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Delete only the assembled-in-the-USA sentence. Stored catalog rows use this, not a replacement. */
export function withoutAssembledInUsa(value: string) {
  if (!value.includes(ASSEMBLED_IN_USA_SENTENCE)) return value;
  return tidyDescription(value.replaceAll(ASSEMBLED_IN_USA_SENTENCE, ""));
}

/** Drop the desk engine's ship sentence, including its day plan and import clause. */
export function shopperDescription(value: string) {
  return tidyDescription(value.replaceAll(ASSEMBLED_IN_USA_SENTENCE, "").replace(ENGINE_SHIP_SENTENCE, ""));
}

const US_STATE_CODES = new Set([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN", "IA",
  "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
  "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY", "PR", "VI", "GU", "AS", "MP",
]);

const US_STATE_NAMES = new Set([
  "alabama", "alaska", "arizona", "arkansas", "california", "colorado", "connecticut", "delaware",
  "district of columbia", "florida", "georgia", "hawaii", "idaho", "illinois", "indiana", "iowa",
  "kansas", "kentucky", "louisiana", "maine", "maryland", "massachusetts", "michigan", "minnesota",
  "mississippi", "missouri", "montana", "nebraska", "nevada", "new hampshire", "new jersey",
  "new mexico", "new york", "north carolina", "north dakota", "ohio", "oklahoma", "oregon",
  "pennsylvania", "rhode island", "south carolina", "south dakota", "tennessee", "texas", "utah",
  "vermont", "virginia", "washington", "west virginia", "wisconsin", "wyoming", "puerto rico",
  "guam", "american samoa", "us virgin islands", "u.s. virgin islands",
]);

export type ShipSource = {
  supplierName?: string | null;
  shipsFrom?: string | null;
  supplierUsConfirmed?: boolean | null;
};

export function shipDaysConfirmed(min?: number | null, max?: number | null) {
  return (min ?? 0) > 0 && (max ?? 0) > 0;
}

/** The store itself is not a separate US supplier. */
export function isStoreSupplier(name?: string | null) {
  const letters = (name ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return letters.includes("xvaisle");
}

/** A ships-from line counts as the US only when it names a US place. */
export function isUsLocation(value?: string | null) {
  const text = value?.trim() ?? "";
  if (!text) return false;
  if (/united states|\bu\.s\.a\.?\b|\bu\.s\.\b|\busa\b/i.test(text)) return true;
  const last = text.split(",").pop()?.trim() ?? "";
  if (US_STATE_CODES.has(last.toUpperCase())) return true;
  const compact = last.toLowerCase().replace(/[^a-z]/g, "");
  if (compact === "us" || compact === "usa" || compact === "unitedstates" || compact === "unitedstatesofamerica") {
    return true;
  }
  return US_STATE_NAMES.has(last.toLowerCase().replace(/\./g, ""));
}

/** The place sentence needs a real supplier, a US ships-from, and the confirmed flag. */
export function shopperMayNameUsSupplier(source?: ShipSource | null) {
  if (!source) return false;
  if (source.shipsFrom != null) return usSupplierConfirmed(source);
  return source.supplierUsConfirmed === true;
}

/** All three have to be true: a real supplier, a US ships-from, and the confirmed flag. */
export function usSupplierConfirmed(source?: ShipSource | null) {
  const name = source?.supplierName?.trim() ?? "";
  if (!name || isStoreSupplier(name)) return false;
  if (source?.supplierUsConfirmed !== true) return false;
  return isUsLocation(source?.shipsFrom);
}

export function unconfirmedShipLine(source?: ShipSource | null) {
  return usSupplierConfirmed(source) ? US_SUPPLIER_SHIP : TRACKING_SHIP;
}

/** Product page, receipts, order pages, and mail. The US line and the day window require a confirmed US supplier. */
export function productShipLine(
  listing: ShipSource & { supplierName: string; shipDaysMin?: number | null; shipDaysMax?: number | null },
): string {
  if (!usSupplierConfirmed(listing)) return TRACKING_SHIP;
  const min = listing.shipDaysMin;
  const max = listing.shipDaysMax;
  if (
    typeof min !== "number" ||
    typeof max !== "number" ||
    !Number.isInteger(min) ||
    !Number.isInteger(max) ||
    min <= 0 ||
    max <= 0 ||
    min > max
  ) {
    return US_SUPPLIER_SHIP;
  }
  const span = min === max ? String(min) : `${min}–${max}`;
  return `Our expected window is ${span} days after you pay.`;
}

/** Receipts, the order page, and mail. A day window needs a confirmed supplier and confirmed ship days. */
export function receiptShipWindow(min?: number | null, max?: number | null, source?: ShipSource | null) {
  const daysReady =
    shipDaysConfirmed(min, max) &&
    typeof min === "number" &&
    typeof max === "number" &&
    Number.isInteger(min) &&
    Number.isInteger(max) &&
    min <= max;
  if (!usSupplierConfirmed(source) || !daysReady) return unconfirmedShipLine(source);
  const span = min === max ? String(min) : `${min}–${max}`;
  return `Our expected window is ${span} days after you pay.`;
}

/** Arrival copy for an order. Same confirmed-supplier rule as the product page. */
export function etaFromListing(
  listing:
    | (ShipSource & { deliveryTime?: string | null; shipDaysMin?: number | null; shipDaysMax?: number | null })
    | null
    | undefined,
) {
  return receiptShipWindow(listing?.shipDaysMin, listing?.shipDaysMax, listing);
}
