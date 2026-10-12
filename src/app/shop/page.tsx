"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid } from "@/components/shop-grid";
import { aisleBySlug } from "@/lib/aisles";

function ShopCatalog() {
  const slug = useSearchParams().get("aisle")?.trim() ?? "";
  const aisle = slug ? aisleBySlug(slug) : null;
  return (
    <ShopGrid
      kicker={aisle ? "Aisle" : "Store"}
      title={aisle ? aisle.title : "What is ready to ship"}
      lede="Payment goes to Stripe. After it clears, the order is sent to the supplier that holds the stock."
      query={aisle ? `?aisle=${encodeURIComponent(aisle.slug)}` : ""}
      empty={aisle ? "Nothing in this aisle is marked ready yet." : "Nothing is marked ready yet."}
    />
  );
}

export default function ShopPage() {
  return (
    <ShopFrame>
      <Suspense fallback={<p className="px-5 py-16 text-sm text-muted-foreground">Opening the store…</p>}>
        <ShopCatalog />
      </Suspense>
    </ShopFrame>
  );
}
