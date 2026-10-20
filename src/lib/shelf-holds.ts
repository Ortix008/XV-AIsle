import { QA_CHECKOUT_PRODUCT_ID } from "./qa-checkout";
import { sampleStarters } from "./sample-shelf";

/** Seeded stand-in. Not a supplier a shopper can buy from. */
export const SEEDED_SUPPLIER_NAME = "Northwharf Goods";

export const WOOD_TRAY_PRODUCT_ID = "wood-tray";
export const SCENTED_CANDLE_PRODUCT_ID = "scented-candle-16-oz";

const WOOD_TRAY_TITLE = "wood tray";
const SCENTED_CANDLE_TITLE = "scented candle 16 oz";

export function isSeededSupplier(name?: string | null) {
  return (name ?? "").trim() === SEEDED_SUPPLIER_NAME;
}

/** Product ids of the demo samples. qa-checkout is not one of them. */
export function seededSampleProductIds() {
  return sampleStarters.map((item) => item.productId);
}

/**
 * The sample marker: a seeded demo product under the stand-in supplier, or an explicit sample flag.
 * A linked supplier account does not clear it. qa-checkout is never a sample.
 */
export function isDemoSample(listing: {
  productId?: string | null;
  supplierName?: string | null;
  sample?: boolean | null;
}) {
  if (listing.productId === QA_CHECKOUT_PRODUCT_ID) return false;
  if (listing.sample === true) return true;
  if (!listing.productId || !seededSampleProductIds().includes(listing.productId)) return false;
  return isSeededSupplier(listing.supplierName);
}

/** A preview sample. It can be seen, and it cannot be sold, even when an account is linked. */
export function isHeldSample(listing: {
  productId?: string | null;
  supplierName?: string | null;
  supplierAccountId?: string | null;
  sample?: boolean | null;
}) {
  return isDemoSample(listing);
}

export function isWoodTrayListing(listing: { productId?: string | null; title?: string | null }) {
  if (listing.productId === WOOD_TRAY_PRODUCT_ID) return true;
  return (listing.title ?? "").trim().toLowerCase() === WOOD_TRAY_TITLE;
}

export function isScentedCandleListing(listing: { productId?: string | null; title?: string | null }) {
  if (listing.productId === SCENTED_CANDLE_PRODUCT_ID) return true;
  return (listing.title ?? "").trim().toLowerCase() === SCENTED_CANDLE_TITLE;
}
