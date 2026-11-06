import { isStoreSupplier } from "@/lib/order-facts";

/** Pet-category rows stay in the database. They are not a public offer. */
export function isPetListing(listing: { productId?: string | null; sku?: string | null; title?: string | null }) {
  const blob = `${listing.productId ?? ""} ${listing.sku ?? ""} ${listing.title ?? ""}`;
  return /\b(?:beagles?|corgis?|pets?)\b/i.test(blob) || /pet-seat-belt/i.test(blob);
}

/**
 * A store-named supplier is not a confirmed shipper. Pet listings are out of
 * public sale. Neither check deletes an order row.
 */
export function blockedPublicListing(listing: {
  productId?: string | null;
  sku?: string | null;
  title?: string | null;
  supplierName?: string | null;
}) {
  return isPetListing(listing) || isStoreSupplier(listing.supplierName);
}
