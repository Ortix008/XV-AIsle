import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { getListing } from "@/lib/server/store";

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const { productId } = await context.params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing)) return Response.json({ error: "That page is not on the store." }, { status: 404 });
  return Response.json({
    listing: {
      productId: listing.productId,
      sku: listing.sku,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      image: listing.image,
      supplierName: listing.supplierName,
      supplierOrigin: listing.supplierOrigin,
      shipDaysMin: listing.shipDaysMin,
      shipDaysMax: listing.shipDaysMax,
      madeInUsa: listing.madeInUsa,
      shelf: listing.shelf,
      sample: isSampleListing(listing),
    },
  });
}
