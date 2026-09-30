"use client";

import Link from "next/link";
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
      <p className="mx-auto -mt-4 max-w-5xl px-4 pb-8 text-sm sm:px-6">
        <Link href="/shop/usa" className="underline underline-offset-4">
          Made in the USA
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href="/shop/small" className="underline underline-offset-4">
          Small business
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href="/shop/x" className="underline underline-offset-4">
          From X
        </Link>
        <span className="text-muted-foreground"> · </span>
        <Link href="/shop/safety" className="underline underline-offset-4">
          How buying works
        </Link>
      </p>
    </ShopFrame>
  );
}
