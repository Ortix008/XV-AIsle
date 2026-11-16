import type { Metadata } from "next";
import { AisleIndex } from "@/components/amazon-aisles";
import { ShopFrame } from "@/components/shop-frame";
import { experiencesSpotHasLinks } from "@/config/affiliates";
import { AISLE_INDEX_COPY, AMAZON_AISLES } from "@/lib/amazon-aisles";

export const metadata: Metadata = {
  title: AISLE_INDEX_COPY.title,
  description: AISLE_INDEX_COPY.description,
};

export default function AislesPage() {
  return (
    <ShopFrame showStorePayLine={false} showBrandBlock={false}>
      <AisleIndex
        aisles={AMAZON_AISLES}
        includeTickets={experiencesSpotHasLinks() || (AMAZON_AISLES.find((aisle) => aisle.slug === "tickets-and-events")?.items.length ?? 0) > 0}
      />
    </ShopFrame>
  );
}
