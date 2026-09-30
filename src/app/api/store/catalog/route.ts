import { STORE_HOST } from "@/lib/domain";
import { ensureStarterShelf, visibleOnShop } from "@/lib/server/starter-shelf";
import { listPublished } from "@/lib/server/store";
import { appOrigin } from "@/lib/server/stripe";

export function GET() {
  ensureStarterShelf();
  const origin = appOrigin();
  const products = listPublished()
    .filter(visibleOnShop)
    .map((listing) => ({
      id: listing.productId,
      title: listing.title,
      description: listing.description,
      price: (listing.priceCents / 100).toFixed(2),
      currency: "USD",
      link: `${origin}/shop/${listing.productId}`,
      image: listing.image ? `${origin}${listing.image}` : "",
      availability: "in stock",
      brand: listing.supplierName,
      madeInUsa: listing.madeInUsa,
      shelf: listing.shelf,
    }));
  return Response.json({
    domain: STORE_HOST,
    store: `${origin}/shop`,
    catalog: `${origin}/api/store/catalog`,
    checkout: "The buyer pays on xvaisle.com through Stripe.",
    products,
  });
}
