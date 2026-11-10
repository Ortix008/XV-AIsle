import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid, type ShopCard } from "@/components/shop-grid";
import { aisleBySlug } from "@/lib/aisles";
import { nightWorldBySlug } from "@/lib/night-worlds";
import { publicGridListings } from "@/lib/server/shop-catalog";

export const dynamic = "force-dynamic";

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function ShopScreen({ slug, listings }: { slug: string; listings: ShopCard[] }) {
  const aisle = slug ? aisleBySlug(slug) : null;
  const world = slug ? nightWorldBySlug(slug) : null;
  const filter = world?.slug === "bundles" ? "bundles" : aisle?.slug;
  return (
    <ShopFrame>
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
        initialListings={listings}
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
  const aisle = slug ? aisleBySlug(slug) : null;
  const world = slug ? nightWorldBySlug(slug) : null;
  const filter = world?.slug === "bundles" ? "bundles" : aisle?.slug;
  return <ShopScreen slug={slug} listings={publicGridListings(filter) as ShopCard[]} />;
}
