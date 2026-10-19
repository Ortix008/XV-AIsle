/** Seeded stand-in. Not a supplier a shopper can buy from. */
export const SEEDED_SUPPLIER_NAME = "Northwharf Goods";

export const WOOD_TRAY_PRODUCT_ID = "wood-tray";

const WOOD_TRAY_TITLE = "wood tray";

export function isSeededSupplier(name?: string | null) {
  return (name ?? "").trim() === SEEDED_SUPPLIER_NAME;
}

/** A preview sample whose supplier is only the seeded stand-in. It can be seen, and it cannot be sold. */
export function isHeldSample(listing: { supplierName?: string | null; supplierAccountId?: string | null }) {
  if (listing.supplierAccountId) return false;
  return isSeededSupplier(listing.supplierName);
}

export function isWoodTrayListing(listing: { productId?: string | null; title?: string | null }) {
  if (listing.productId === WOOD_TRAY_PRODUCT_ID) return true;
  return (listing.title ?? "").trim().toLowerCase() === WOOD_TRAY_TITLE;
}
