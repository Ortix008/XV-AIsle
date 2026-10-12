import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { getListing, listingLoss, publicShopListing } from "@/lib/server/store";

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) {
    return Response.json({ error: "That page is not on the store." }, { status: 404 });
  }
  return Response.json({
    listing: publicShopListing(listing, isSampleListing(listing)),
  });
}
