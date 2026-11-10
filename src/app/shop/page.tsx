import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid, type ShopCard } from "@/components/shop-grid";
import { aisleBySlug } from "@/lib/aisles";
import { canonicalStallSlug, LEGACY_RIG_SLUG, nightWorldBySlug } from "@/lib/night-worlds";
import { showShopPrices } from "@/lib/shop-prices";
import { shopCardsWithPhotos } from "@/lib/shop-photo";
import { listingInStall, stallsWithProducts } from "@/lib/shop-stalls";
import { publicGridListings } from "@/lib/server/shop-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: "Shop | XV-AIsle" },
};

const SHOP_LEDE =
  "Every item is reviewed before it's listed. Shipping details are added to each product once its supplier confirms them.";

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function ShopScreen({
  slug,
  listings,
  showPrices = false,
}: {
  slug: string;
  listings: ShopCard[];
  showPrices?: boolean;
}) {
  const canonical = canonicalStallSlug(slug);
  const aisle = canonical ? aisleBySlug(canonical) : null;
  const world = canonical ? nightWorldBySlug(canonical) : null;
  const photos = shopCardsWithPhotos(listings);
  const stalls = stallsWithProducts(photos);
  const shown = world ? photos.filter((item) => listingInStall(item, world.slug)) : photos;
  return (
    <ShopFrame>
      <ShopGrid
        kicker={world || aisle ? "Aisle" : "Store"}
        title={world ? world.title : aisle ? aisle.title : "What's on the shelves"}
        lede={world ? world.story : SHOP_LEDE}
        query={world ? `?aisle=${encodeURIComponent(world.slug)}` : ""}
        empty={
          world || aisle
            ? "This aisle is quiet for now. Every piece is reviewed before it's listed, and new ones will show up here."
            : "Nothing's on the shelves yet. We're picking the first pieces now."
        }
        world={world}
        catalog
        stalls={stalls}
        showPrices={showPrices}
        initialListings={shown}
      />
    </ShopFrame>
  );
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const slug = firstParam(params.aisle);
  if (slug === LEGACY_RIG_SLUG) redirect("/shop?aisle=everyday-finds");
  const listings = publicGridListings() as ShopCard[];
  return <ShopScreen slug={slug} listings={listings} showPrices={showShopPrices()} />;
}
