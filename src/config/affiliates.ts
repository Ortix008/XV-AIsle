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
  everglades:
    "https://www.getyourguide.com/orlando-l191/orlando-everglades-airboat-ride-and-wildlife-park-ticket-t20590/?partner_id=YEH3QKQ",
} as const;

const BOOK_LABELS = {
  salt: "See Salt, Fat, Acid, Heat on Bookshop.org",
  simple: "See Ottolenghi Simple on Bookshop.org",
  habits: "See Atomic Habits on Bookshop.org",
  dog: "See Dog Is Love on Bookshop.org",
} as const;

const TOUR_LABELS = {
  kennedy: "See the Kennedy Space Center trip on GetYourGuide",
  everglades: "See the Everglades airboat ride on GetYourGuide",
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
    route: "/shop?aisle=home-and-gifts",
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
  },
  {
    id: "getyourguide",
    network: "getyourguide",
    spot: "experiences",
    href: "https://www.getyourguide.com/?partner_id=YEH3QKQ",
    label: AFFILIATE_COPY.getyourguideLink,
    partnerId: "YEH3QKQ",
    disclosure: AFFILIATE_DISCLOSURE_SHORT,
    picks: picksFrom(NEW_PICK_COPY.tours, TOUR_HREFS, TOUR_LABELS),
  },
  {
    id: "zazzle",
    network: "zazzle",
    spot: "gifts",
    href: "https://www.zazzle.com/?rf=238672294015858667",
    label: AFFILIATE_COPY.zazzleLink,
    partnerId: "238672294015858667",
    disclosure: AFFILIATE_DISCLOSURE_SHORT,
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

/** True when Bookshop or Zazzle has a pasted href. */
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
