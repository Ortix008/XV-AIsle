import { comingSoonListing } from "./supplier-confirm";

type PublicShelfListing = {
  kind?: string | null;
  supplierName?: string | null;
  shipsFrom?: string | null;
  supplierUsConfirmed?: boolean | null;
};

/** Coming soon rows and bundles stay out of shopper lists, search, and the sitemap. */
export function shopperListingOmitted(listing: PublicShelfListing) {
  if (listing.kind === "bundle") return true;
  return comingSoonListing(listing);
}
