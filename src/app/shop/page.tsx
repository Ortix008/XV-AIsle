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
      title={world ? world.title : aisle ? aisle.title : "What's on the shelves"}
      lede={
        world
          ? world.story
          : "Pay safely with Stripe, and your order ships straight to your door."
      }
      query={filter ? `?aisle=${encodeURIComponent(filter)}` : ""}
      empty={
        world || aisle
          ? "This aisle is quiet for now. Every piece is reviewed before it's listed, and new ones will show up here."
          : "Nothing's on the shelves yet. We're picking the first pieces now."
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
