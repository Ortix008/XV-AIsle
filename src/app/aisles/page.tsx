import type { Metadata } from "next";
import { AisleIndex } from "@/components/amazon-aisles";
import { PreloadImage } from "@/components/preload-image";
import { ShopFrame } from "@/components/shop-frame";
import { experiencesSpotHasLinks } from "@/config/affiliates";
import { AISLE_INDEX_COPY, AISLE_TILE_SIZES, AMAZON_AISLES, aisleCardArt } from "@/lib/amazon-aisles";
import { homeGiftsListed } from "@/lib/home-aisles";
import { nightWorldBySlug } from "@/lib/night-worlds";
import { publicGridListings } from "@/lib/server/shop-catalog";

export const metadata: Metadata = {
  title: AISLE_INDEX_COPY.title,
  description: AISLE_INDEX_COPY.description,
};

export default function AislesPage() {
  const gifts = homeGiftsListed(publicGridListings()) ? nightWorldBySlug("home-and-gifts") : undefined;
  const firstArt = gifts ? aisleCardArt("home-and-gifts") : undefined;
  const preloadHref = firstArt?.avifSrcSet?.split(" ")[0];
  return (
    <ShopFrame showStorePayLine={false} showBrandBlock={false}>
      {firstArt?.avifSrcSet && preloadHref ? (
        <PreloadImage
          href={preloadHref}
          imageSrcSet={firstArt.avifSrcSet}
          imageSizes={AISLE_TILE_SIZES}
          type="image/avif"
        />
      ) : null}
      <AisleIndex
        aisles={AMAZON_AISLES}
        includeTickets={experiencesSpotHasLinks() || (AMAZON_AISLES.find((aisle) => aisle.slug === "tickets-and-events")?.items.length ?? 0) > 0}
        extras={
          gifts
            ? [{ href: "/shop?aisle=home-and-gifts", name: gifts.title, intro: gifts.story, art: aisleCardArt("home-and-gifts") }]
            : []
        }
      />
    </ShopFrame>
  );
}
