import { STORE_HOST } from "@/lib/domain";
import { publicListing } from "@/lib/server/order-view";
import { ensurePodShelf } from "@/lib/server/pod-shelf";
import { ensureStarterShelf, isSampleListing, listedOnGrid } from "@/lib/server/starter-shelf";
import { listPublished } from "@/lib/server/store";
import { appOrigin } from "@/lib/server/stripe";

export function GET() {
  ensureStarterShelf();
  ensurePodShelf();
  const origin = appOrigin();
  const products = listPublished()
    .filter(listedOnGrid)
    .map((listing) => {
      const page = publicListing(listing, isSampleListing(listing));
      return {
        id: page.productId,
        title: page.title,
        description: page.description,
        price: page.priceCents >= 50 ? (page.priceCents / 100).toFixed(2) : null,
        currency: "USD",
        link: `${origin}/shop/${page.productId}`,
        image: page.image ? `${origin}${page.image}` : "",
        availability: "in stock",
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
