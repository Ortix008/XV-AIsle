import { notFound } from "next/navigation";
import { ProductBuy } from "@/components/product-buy";
import { ShopFrame } from "@/components/shop-frame";
import { publicListing } from "@/lib/server/order-view";
import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { getListing, listingLoss } from "@/lib/server/store";

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) notFound();
  return (
    <ShopFrame>
      <ProductBuy listing={publicListing(listing, isSampleListing(listing))} />
    </ShopFrame>
  );
}
