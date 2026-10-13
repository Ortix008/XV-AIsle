import { notFound } from "next/navigation";
import { AislePicks, type AislePick } from "@/components/aisle-picks";
import { ProductBuy } from "@/components/product-buy";
import { ShopFrame } from "@/components/shop-frame";
import { publicListing } from "@/lib/server/order-view";
import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { returnCopyForListing } from "@/lib/server/supplier-returns";
import { getListing, listPublished, listingLoss } from "@/lib/server/store";

function aisleKey(listing: { kind: string; aisle: string | null }) {
  if (listing.kind === "bundle") return "bundles";
  return listing.aisle;
}

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) notFound();
  const aisle = aisleKey(listing);
  const picks: AislePick[] = aisle
    ? listPublished({ aisle })
        .filter((item) => item.productId !== listing.productId && visibleOnShop(item))
        .slice(0, 4)
        .map((item) => ({
          productId: item.productId,
          title: item.title,
          priceCents: item.priceCents,
          image: item.image,
          aisle: item.aisle,
          kind: item.kind === "bundle" ? "bundle" : undefined,
        }))
    : [];
  return (
    <ShopFrame>
      <ProductBuy listing={publicListing(listing, isSampleListing(listing))} returnNote={returnCopyForListing(listing)} />
      <AislePicks aisle={aisle} picks={picks} />
    </ShopFrame>
  );
}
