"use client";

import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid } from "@/components/shop-grid";

export default function MadeInUsaPage() {
  return (
    <ShopFrame>
      <ShopGrid
        kicker="Made in the USA"
        title="Goods made here"
        lede="These pages are marked Made in the USA by the seller. A US warehouse is not the same thing. The mark is only for goods made in the country."
        query="?madeInUsa=1"
        empty="Nothing marked Made in the USA is ready yet."
      />
    </ShopFrame>
  );
}
