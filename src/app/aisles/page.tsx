import type { Metadata } from "next";
import { AisleIndex } from "@/components/amazon-aisles";
import { ShopFrame } from "@/components/shop-frame";
import { experiencesSpotHasLinks } from "@/config/affiliates";
import { AISLE_INDEX_COPY, AMAZON_AISLES } from "@/lib/amazon-aisles";
import { homeGiftsListed } from "@/lib/home-aisles";
import { nightWorldBySlug } from "@/lib/night-worlds";
import { publicGridListings } from "@/lib/server/shop-catalog";

export const metadata: Metadata = {
  title: AISLE_INDEX_COPY.title,
  description: AISLE_INDEX_COPY.description,
};

export default function AislesPage() {
  const gifts = homeGiftsListed(publicGridListings()) ? nightWorldBySlug("home-and-gifts") : undefined;
  return (
    <ShopFrame showStorePayLine={false} showBrandBlock={false}>
      <AisleIndex
        aisles={AMAZON_AISLES}
        includeTickets={experiencesSpotHasLinks() || (AMAZON_AISLES.find((aisle) => aisle.slug === "tickets-and-events")?.items.length ?? 0) > 0}
        extras={gifts ? [{ href: "/shop?aisle=home-and-gifts", name: gifts.title, intro: gifts.story }] : []}
      />
    </ShopFrame>
  );
}
