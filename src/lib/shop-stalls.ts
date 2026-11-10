import { canonicalStallSlug, nightWorlds, type NightWorldSlug } from "@/lib/night-worlds";

export type StallListing = {
  kind?: string | null;
  aisle?: string | null;
};

export function listingInStall(listing: StallListing, slug: string) {
  const stall = canonicalStallSlug(slug);
  if (listing.kind === "bundle") return stall === "bundles";
  return canonicalStallSlug(listing.aisle ?? "") === stall;
}

export function stallProductCount(listings: readonly StallListing[], slug: string) {
  return listings.filter((listing) => listingInStall(listing, slug)).length;
}

/** Tabs follow the cards. An aisle with nothing in it is not shown. */
export function stallsWithProducts<T extends StallListing>(listings: readonly T[]) {
  return nightWorlds.filter((world) => stallProductCount(listings, world.slug) > 0);
}

export function isStallSlug(slug: string): slug is NightWorldSlug {
  return nightWorlds.some((world) => world.slug === canonicalStallSlug(slug));
}
