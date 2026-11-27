import { NEW_PICK_COPY } from "@/lib/new-pick-copy";

export const AFFILIATE_DISCLOSURE =
  "We may earn a commission when you buy through these links, at no extra cost to you.";

/** The line on every partner card until a program sets its own. */
export const AFFILIATE_DISCLOSURE_SHORT = "We may earn a commission when you buy through these links.";

export const AFFILIATE_COPY = {
  booksHeading: "Gift a book",
  bookshopLink: "Browse books on Bookshop.org",
  experiencesHeading: "Tours and things to do",
  viatorLink: "See things to do on Viator",
  getyourguideLink: "See things to do on GetYourGuide",
  giftsHeading: "Gift ideas",
  zazzleLink: "Browse gifts on Zazzle",
} as const;

export const PARTNER_CARD_NAME = {
  bookshop: "Bookshop.org",
  viator: "Viator",
  getyourguide: "GetYourGuide",
  zazzle: "Zazzle",
} as const;

export type AffiliateNetwork = "bookshop" | "viator" | "getyourguide" | "zazzle";

export type AffiliateSpot = "books" | "experiences" | "gifts";

export type AffiliatePick = {
  id: string;
  name: string;
  why: string;
  href: string;
  /** Accessible name of the card link. The general shop link uses the offer label. */
  label: string;
};

export type AffiliateOffer = {
  id: string;
  network: AffiliateNetwork;
  spot: AffiliateSpot;
  /** Pasted from the program's link builder. Empty until that link is supplied. */
  href: string;
  label: string;
  /** Public partner id. Not a secret, and not used to build href. */
  partnerId: string;
  disclosure: string;
  /** Extra cards on the same partner, using that partner's label and disclosure. */
  picks?: readonly AffiliatePick[];
};

export const BOOKSHOP_OFFER_HREF = "https://bookshop.org/a/131173";

const BOOK_HREFS = {
  salt: "https://bookshop.org/a/131173/9781476753836",
  simple: "https://bookshop.org/a/131173/9781607749165",
  habits: "https://bookshop.org/a/131173/9780735211292",
  dog: "https://bookshop.org/a/131173/9780358414230",
} as const;

const TOUR_HREFS = {
  kennedy: "https://www.getyourguide.com/orlando-l191/kennedy-space-center-tour-t11881/?partner_id=YEH3QKQ&mkt_cmp=true",
} as const;

const BOOK_LABELS = {
  salt: "See Salt, Fat, Acid, Heat on Bookshop.org",
  simple: "See Ottolenghi Simple on Bookshop.org",
  habits: "See Atomic Habits on Bookshop.org",
  dog: "See Dog Is Love on Bookshop.org",
} as const;

const TOUR_LABELS = {
  kennedy: "See the Kennedy Space Center trip on GetYourGuide",
} as const;

function picksFrom<Key extends string>(
  copy: Record<Key, { name: string; why: string }>,
  hrefs: Record<Key, string>,
  labels: Record<Key, string>,
): AffiliatePick[] {
  return (Object.keys(hrefs) as Key[]).map((id) => ({
    id,
    name: copy[id].name,
    why: copy[id].why,
    href: hrefs[id],
    label: labels[id],
  }));
}

const VIATOR_LINK_QUERY = "pid=P00330828&mcid=42383&medium=link";

function viatorTourHref(path: string) {
  const url = new URL(path);
  url.search = VIATOR_LINK_QUERY;
  return url.href;
}

/**
 * Viator tour cards. The existing everglades name and why-line stay; the
 * href now points at the approved 5467OHEP tour. Per-card link labels were
 * not supplied, so cards use the approved “See things to do on Viator” line.
 */
export const VIATOR_TOUR_PICKS: readonly AffiliatePick[] = [
  {
    id: "everglades",
    name: NEW_PICK_COPY.tours.everglades.name,
    why: NEW_PICK_COPY.tours.everglades.why,
    href: viatorTourHref(
      "https://www.viator.com/tours/Orlando/Florida-Everglades-Airboat-Tour-and-Alligator-Encounter-with-Optional-Lunch/d663-5467OHEP",
    ),
    label: AFFILIATE_COPY.viatorLink,
  },
  {
    id: "kayak",
    name: NEW_PICK_COPY.tours.kayak.name,
    why: NEW_PICK_COPY.tours.kayak.why,
    href: viatorTourHref(
      "https://www.viator.com/tours/Clearwater/Clear-Kayak-Tour-of-Tarpon-Springs-Manatee-Season/d22457-173028P2",
    ),
    label: AFFILIATE_COPY.viatorLink,
  },
  {
    id: "toot",
    name: NEW_PICK_COPY.tours.toot.name,
    why: NEW_PICK_COPY.tours.toot.why,
    href: viatorTourHref(
      "https://www.viator.com/tours/Clearwater/Dolphin-Adventure-Tour/d22457-179637P1",
    ),
    label: AFFILIATE_COPY.viatorLink,
  },
];

const ZAZZLE_RF = "238672294015858667";

function zazzleProductHref(path: string) {
  const url = new URL(path);
  url.searchParams.set("rf", ZAZZLE_RF);
  return url.href;
}

/**
 * Zazzle product cards on the Holiday aisle “Gift ideas” spot. Per-card link
 * labels use the approved “Browse gifts on Zazzle” line. The Ambassador id is
 * already on the shop link and on each product href.
 */
export const ZAZZLE_GIFT_PICKS: readonly AffiliatePick[] = [
  {
    id: "ornament",
    name: "Custom Photo Ornament",
    why: "Add a favorite photo to a ceramic ornament for the tree this year.",
    href: zazzleProductHref("https://www.zazzle.com/create_your_own_custom_ceramic_ornament-175607631410889940"),
    label: AFFILIATE_COPY.zazzleLink,
  },
  {
    id: "mug",
    name: "Custom Coffee Mug",
    why: "Put a name, photo or note on a mug, an easy gift for family.",
    href: zazzleProductHref("https://www.zazzle.com/custom_coffee_mugs-168710004482190645"),
    label: AFFILIATE_COPY.zazzleLink,
  },
  {
    id: "throw",
    name: "Custom Photo Fleece Throw",
    why: "Turn a family photo into a cozy 30x40 fleece throw.",
    href: zazzleProductHref("https://www.zazzle.com/fleece_blanket-256136298078136813"),
    label: AFFILIATE_COPY.zazzleLink,
  },
];

/** Cards with a pasted href. An empty href is left out. */
export function visibleAffiliatePicks(picks: readonly AffiliatePick[] | undefined) {
  return (picks ?? []).filter((pick) => pick.href.trim().length > 0);
}

export type AffiliateItem = {
  personalized?: boolean;
  kind?: string | null;
  title?: string | null;
  productId?: string | null;
};

/** Where each spot is mounted. Empty hrefs render nothing, and empty spots are not linked. */
export const AFFILIATE_PLACEMENTS = [
  {
    spot: "books" as const,
    route: "/shop?aisle=home-and-gifts",
    section: "Gift a book",
    component: "AffiliateSpot",
    partners: ["bookshop"] as const,
  },
  {
    spot: "experiences" as const,
    route: "/aisles/tickets-and-events",
    section: "Tours and things to do",
    component: "AffiliateSpot",
    partners: ["viator", "getyourguide"] as const,
  },
  {
    spot: "gifts" as const,
    route: "/aisles/holiday",
    section: "Gift ideas",
    component: "AffiliateSpot",
    partners: ["zazzle"] as const,
  },
] as const;

export const AFFILIATE_OFFERS: readonly AffiliateOffer[] = [
  {
    id: "bookshop",
    network: "bookshop",
    spot: "books",
    href: BOOKSHOP_OFFER_HREF,
    label: AFFILIATE_COPY.bookshopLink,
    partnerId: "131173",
    disclosure: AFFILIATE_DISCLOSURE_SHORT,
    picks: picksFrom(NEW_PICK_COPY.books, BOOK_HREFS, BOOK_LABELS),
  },
  {
    id: "viator",
    network: "viator",
    spot: "experiences",
    href: "https://www.viator.com/?pid=P00330828&mcid=42383&medium=link",
    label: AFFILIATE_COPY.viatorLink,
    partnerId: "P00330828",
    disclosure: AFFILIATE_DISCLOSURE_SHORT,
    picks: VIATOR_TOUR_PICKS,
  },
  {
    id: "getyourguide",
    network: "getyourguide",
    spot: "experiences",
    href: "https://www.getyourguide.com/?partner_id=YEH3QKQ",
    label: AFFILIATE_COPY.getyourguideLink,
    partnerId: "YEH3QKQ",
    disclosure: AFFILIATE_DISCLOSURE_SHORT,
    picks: picksFrom({ kennedy: NEW_PICK_COPY.tours.kennedy }, TOUR_HREFS, TOUR_LABELS),
  },
  {
    id: "zazzle",
    network: "zazzle",
    spot: "gifts",
    href: "https://www.zazzle.com/?rf=238672294015858667",
    label: AFFILIATE_COPY.zazzleLink,
    partnerId: "238672294015858667",
    disclosure: AFFILIATE_DISCLOSURE_SHORT,
    picks: ZAZZLE_GIFT_PICKS,
  },
];

export const AFFILIATE_SPOT_HEADING: Record<AffiliateSpot, string> = {
  books: AFFILIATE_COPY.booksHeading,
  experiences: AFFILIATE_COPY.experiencesHeading,
  gifts: AFFILIATE_COPY.giftsHeading,
};

/** True when at least one Experiences href is set. An empty href does not count. */
export function experiencesSpotHasLinks(offers: readonly AffiliateOffer[] = AFFILIATE_OFFERS) {
  return visibleAffiliateOffers("experiences", null, offers).length > 0;
}

/** True when Bookshop or Zazzle has a pasted href. Home & Gifts visibility uses the Bookshop offer only. */
export function giftSpotsHaveLinks(offers: readonly AffiliateOffer[] = AFFILIATE_OFFERS) {
  return (
    visibleAffiliateOffers("books", null, offers).length > 0 || visibleAffiliateOffers("gifts", null, offers).length > 0
  );
}

/** Tickets & Events is listed only when it has Amazon items or a configured experiences link. */
export function ticketsAisleListed(itemCount: number, offers: readonly AffiliateOffer[] = AFFILIATE_OFFERS) {
  return itemCount > 0 || experiencesSpotHasLinks(offers);
}

/** Personalized goods, including their tiles, never carry a Zazzle link. */
export function isPersonalizedItem(item: AffiliateItem | null | undefined) {
  if (!item) return false;
  if (item.personalized === true) return true;
  if (item.kind === "personalized") return true;
  const title = item.title ?? "";
  const productId = item.productId ?? "";
  return /personalized/i.test(title) || /personalized/i.test(productId);
}

export function zazzleAllowedOn(item: AffiliateItem | null | undefined) {
  return !isPersonalizedItem(item);
}

export function affiliateDisclosure(disclosure?: string | null) {
  const line = disclosure?.trim() ?? "";
  return line || AFFILIATE_DISCLOSURE_SHORT;
}

export function affiliateLinkVisible(input: {
  href: string;
  network: AffiliateNetwork;
  item?: AffiliateItem | null;
}) {
  if (!input.href.trim()) return false;
  if (input.network === "zazzle" && !zazzleAllowedOn(input.item)) return false;
  return true;
}

export function visibleAffiliateOffers(
  spot: AffiliateSpot,
  item?: AffiliateItem | null,
  offers: readonly AffiliateOffer[] = AFFILIATE_OFFERS,
) {
  return offers.filter((offer) => {
    if (offer.spot !== spot) return false;
    return affiliateLinkVisible({ href: offer.href, network: offer.network, item });
  });
}
