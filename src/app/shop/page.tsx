"use client";

import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid } from "@/components/shop-grid";

export default function ShopPage() {
  return (
    <ShopFrame>
      <ShopGrid
        kicker="Store"
        title="What is ready to ship"
        lede="Payment goes to Stripe. After it clears, the order is sent to the supplier that holds the stock."
        query=""
        empty="Nothing is marked ready yet."
      />
    </ShopFrame>
  );
}
