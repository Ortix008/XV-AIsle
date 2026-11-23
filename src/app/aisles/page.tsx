import type { Metadata } from "next";
import { AisleIndex } from "@/components/amazon-aisles";
import { ShopFrame } from "@/components/shop-frame";
import { experiencesSpotHasLinks } from "@/config/affiliates";
import { AISLE_INDEX_COPY, AMAZON_AISLES, aisleCardArt, liveAisles } from "@/lib/amazon-aisles";
import { homeGiftsListed } from "@/lib/home-aisles";
import { nightWorldBySlug } from "@/lib/night-worlds";
import { publicGridListings } from "@/lib/server/shop-catalog";

export const metadata: Metadata = {
  title: AISLE_INDEX_COPY.title,
  description: AISLE_INDEX_COPY.description,
};

export default function AislesPage() {
  const gifts = homeGiftsListed(publicGridListings()) ? nightWorldBySlug("home-and-gifts") : undefined;
  const firstArt = gifts ? aisleCardArt("home-and-gifts") : liveAisles()[0]?.art;
  return (
    <ShopFrame showStorePayLine={false} showBrandBlock={false}>
      {firstArt?.srcSet ? (
        <link
          rel="preload"
          as="image"
          href={firstArt.src}
          imageSrcSet={firstArt.srcSet}
          imageSizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
          fetchPriority="high"
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
