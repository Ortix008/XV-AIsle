"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid } from "@/components/shop-grid";
import { aisleBySlug } from "@/lib/aisles";
import { nightWorldBySlug } from "@/lib/night-worlds";

function ShopCatalog() {
  const slug = useSearchParams().get("aisle")?.trim() ?? "";
  const aisle = slug ? aisleBySlug(slug) : null;
  const world = slug ? nightWorldBySlug(slug) : null;
  const filter = world?.slug === "bundles" ? "bundles" : aisle?.slug;
  return (
    <ShopGrid
      kicker={world || aisle ? "Aisle" : "Store"}
      title={world ? world.title : aisle ? aisle.title : "What is ready to ship"}
      lede={
        world
          ? world.story
          : "Payment goes to Stripe. After it clears, the order is sent to the supplier that holds the stock."
      }
      query={filter ? `?aisle=${encodeURIComponent(filter)}` : ""}
      empty={
        world || aisle
          ? "This stall is quiet for now. The next pieces show up here when they are ready."
          : "Nothing is marked ready yet."
      }
      world={world}
      catalog
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
