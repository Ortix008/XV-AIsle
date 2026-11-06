import { STORE_HOST } from "@/lib/domain";
import { blockedPublicListing } from "@/lib/public-sale";
import { soldOutByProduct } from "@/lib/server/inventory";
import { listingMaySell } from "@/lib/server/offer-guard";
import { publicListing } from "@/lib/server/order-view";
import { ensureStarterShelf, isSampleListing, listedOnGrid } from "@/lib/server/starter-shelf";
import { listPublished } from "@/lib/server/store";
import { appOrigin } from "@/lib/server/stripe";

export function GET() {
  ensureStarterShelf();
  const origin = appOrigin();
  const listings = listPublished().filter((listing) => listedOnGrid(listing) && !blockedPublicListing(listing));
  const soldOut = soldOutByProduct(listings.map((listing) => listing.productId));
  const products = listings.map((listing) => {
    const page = publicListing(listing, isSampleListing(listing));
    const sellable = listingMaySell(listing);
    const gone = soldOut.get(page.productId) === true;
    return {
      id: page.productId,
      title: page.title,
      description: page.description,
      price: (page.priceCents / 100).toFixed(2),
      currency: "USD",
      link: `${origin}/shop/${page.productId}`,
      image: page.image ? `${origin}${page.image}` : "",
      availability: !sellable ? "unavailable" : gone ? "out of stock" : "in stock",
      purchasable: sellable && !gone,
      brand: page.supplierName,
      shelf: page.shelf,
    };
  });
  return Response.json({
    domain: STORE_HOST,
    store: `${origin}/shop`,
    catalog: `${origin}/api/store/catalog`,
    checkout: "The buyer pays on xvaisle.com through Stripe.",
    products,
  });
}
