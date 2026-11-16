import { ticketsAisleListed, type AffiliateOffer } from "@/config/affiliates";
import { AMAZON_AISLES, liveAisleBySlug } from "@/lib/amazon-aisles";
import { departmentHref, floorDepartments, type HomeAisleTile } from "@/lib/department-href";
import { nightWorldBySlug, nightWorlds, type NightWorldSlug } from "@/lib/night-worlds";
import { stallProductCount, type StallListing } from "@/lib/shop-stalls";

export type { HomeAisleTile };

/** How many linkable items that href actually shows a signed-out shopper. */
export function visibleItemCount(href: string, listings: readonly StallListing[]) {
  if (href.startsWith("/aisles/")) {
    return liveAisleBySlug(href.slice("/aisles/".length))?.items.length ?? 0;
  }
  const slug = new URL(href, "http://local").searchParams.get("aisle") ?? "";
  if (!slug) return 0;
  if (nightWorldBySlug(slug)) return stallProductCount(listings, slug);
  return listings.length;
}

export function homepageNightSlugs(listings: readonly StallListing[]): NightWorldSlug[] {
  return nightWorlds
    .filter((world) => world.slug !== "bundles" && stallProductCount(listings, world.slug) > 0)
    .map((world) => world.slug);
}

export function homepageMoreAisles(listings: readonly StallListing[], offers?: readonly AffiliateOffer[]): HomeAisleTile[] {
  const tiles: HomeAisleTile[] = [];
  for (const dept of floorDepartments) {
    const href = departmentHref(dept);
    if (!href || visibleItemCount(href, listings) === 0) continue;
    tiles.push({ title: dept.title, line: dept.line, src: dept.src, href });
  }
  const tickets = AMAZON_AISLES.find((aisle) => aisle.slug === "tickets-and-events");
  if (tickets && ticketsAisleListed(tickets.items.length, offers)) {
    tiles.push({
      title: tickets.name,
      line: tickets.intro,
      src: "",
      href: "/aisles/tickets-and-events",
    });
  }
  return tiles;
}
