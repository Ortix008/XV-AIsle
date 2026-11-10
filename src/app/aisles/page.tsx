import type { Metadata } from "next";
import { AisleIndex } from "@/components/amazon-aisles";
import { ShopFrame } from "@/components/shop-frame";
import { AISLE_INDEX_COPY, AMAZON_AISLES } from "@/lib/amazon-aisles";

export const metadata: Metadata = {
  title: AISLE_INDEX_COPY.title,
  description: AISLE_INDEX_COPY.description,
};

export default function AislesPage() {
  return (
    <ShopFrame showStorePayLine={false}>
      <AisleIndex aisles={AMAZON_AISLES} />
    </ShopFrame>
  );
}
