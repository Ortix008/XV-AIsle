import { notFound } from "next/navigation";
import { ProductBuy } from "@/components/product-buy";
import { ShopFrame } from "@/components/shop-frame";
import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { getListing, listingLoss } from "@/lib/server/store";

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) notFound();
  return (
    <ShopFrame>
      <ProductBuy
        listing={{
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
        }}
      />
    </ShopFrame>
  );
}
