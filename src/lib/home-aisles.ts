import { giftSpotsHaveLinks, ticketsAisleListed, type AffiliateOffer } from "@/config/affiliates";
import { AMAZON_AISLES, liveAisleBySlug } from "@/lib/amazon-aisles";
import { departmentHref, floorDepartments, type HomeAisleTile } from "@/lib/department-href";
import { nightWorldBySlug, nightWorlds, type NightWorld, type NightWorldSlug } from "@/lib/night-worlds";
import { stallProductCount, stallsWithProducts, type StallListing } from "@/lib/shop-stalls";

export type { HomeAisleTile };

/** Launch switch. Unset is off, so the homepage night-aisle block stays hidden. */
export function showHomeAisles(value = process.env.SHOW_HOME_AISLES) {
  const flag = value?.trim().toLowerCase() ?? "";
  return flag === "1" || flag === "true" || flag === "on" || flag === "yes";
}

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

/** Home & Gifts is open when it has shop items or a Bookshop/Zazzle link. */
export function homeGiftsListed(listings: readonly StallListing[], offers?: readonly AffiliateOffer[]) {
  return stallProductCount(listings, "home-and-gifts") > 0 || giftSpotsHaveLinks(offers);
}

export function homepageNightSlugs(listings: readonly StallListing[], offers?: readonly AffiliateOffer[]): NightWorldSlug[] {
  return nightWorlds
    .filter((world) => {
      if (world.slug === "bundles") return false;
      if (world.slug === "home-and-gifts") return homeGiftsListed(listings, offers);
      return stallProductCount(listings, world.slug) > 0;
    })
    .map((world) => world.slug);
}

/** Shop tabs follow the cards, and Home & Gifts stays when a partner link is set. */
export function shopStallTabs<T extends StallListing>(listings: readonly T[], offers?: readonly AffiliateOffer[]): NightWorld[] {
  const tabs = stallsWithProducts(listings);
  if (!homeGiftsListed(listings, offers) || tabs.some((tab) => tab.slug === "home-and-gifts")) return tabs;
  const gifts = nightWorldBySlug("home-and-gifts");
  return gifts ? [...tabs, gifts] : tabs;
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
