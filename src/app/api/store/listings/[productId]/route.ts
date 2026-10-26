import { publicListing } from "@/lib/server/order-view";
import { ensurePodShelf } from "@/lib/server/pod-shelf";
import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { getListing, listingLoss } from "@/lib/server/store";

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  ensureStarterShelf();
  ensurePodShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) {
    return Response.json({ error: "That page is not on the store." }, { status: 404 });
  }
  return Response.json({ listing: publicListing(listing, isSampleListing(listing)) });
}
