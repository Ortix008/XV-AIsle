import { publicListing } from "@/lib/server/order-view";
import { soldOutByProduct } from "@/lib/server/inventory";
import { ensureStarterShelf, isSampleListing, listedOnGrid } from "@/lib/server/starter-shelf";
import { listPublished } from "@/lib/server/store";
import { hasRealProductPhoto } from "@/lib/shop-photo";
import { shopperPriceView } from "@/lib/shop-prices";

/** The same public cards the shop grid used to load from /api/store/listings. */
export function publicGridListings(aisle?: string) {
  ensureStarterShelf();
  const listings = listPublished({ aisle }).filter(listedOnGrid).filter((listing) => hasRealProductPhoto(listing.image));
  const soldOut = soldOutByProduct(listings.map((listing) => listing.productId));
  return listings.map((listing) =>
    shopperPriceView({
      ...publicListing(listing, isSampleListing(listing)),
      ...(soldOut.get(listing.productId) ? { soldOut: true as const } : {}),
    }),
  );
}
