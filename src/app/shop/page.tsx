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
      kicker={world ? "Night Boutique" : aisle ? "Aisle" : "Store"}
      title={world ? world.title : aisle ? aisle.title : "What is ready to ship"}
      lede={
        world
          ? world.story
          : "Payment goes to Stripe. After it clears, the order is sent to the supplier that holds the stock."
      }
      query={filter ? `?aisle=${encodeURIComponent(filter)}` : ""}
      empty={world || aisle ? "Nothing in this stall is marked ready yet." : "Nothing is marked ready yet."}
      world={world}
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
