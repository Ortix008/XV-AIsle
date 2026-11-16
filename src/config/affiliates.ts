export const AFFILIATE_DISCLOSURE =
  "We may earn a commission when you buy through these links, at no extra cost to you.";

/** Some programs may use this shorter line. The default stays the longer sentence. */
export const AFFILIATE_DISCLOSURE_SHORT = "We may earn a commission when you buy through these links.";

export const AFFILIATE_WORDY = {
  booksHeading: "[WORDY: Books heading]",
  bookshopLink: "[WORDY: Bookshop link]",
  experiencesHeading: "[WORDY: Experiences heading]",
  viatorLink: "[WORDY: Viator link]",
  getyourguideLink: "[WORDY: GetYourGuide link]",
  giftsHeading: "[WORDY: Gifts heading]",
  zazzleLink: "[WORDY: Zazzle link]",
} as const;

export type AffiliateNetwork = "bookshop" | "viator" | "getyourguide" | "zazzle";

export type AffiliateSpot = "books" | "experiences" | "gifts";

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
};

export type AffiliateItem = {
  personalized?: boolean;
  kind?: string | null;
  title?: string | null;
  productId?: string | null;
};

/**
 * Where each spot belongs. Spots are not mounted while every href is empty.
 * Tickets & Events has no items, so that path 404s and is not linked.
 */
export const AFFILIATE_PLACEMENTS = [
  {
    spot: "books" as const,
    route: "",
    section: "Books",
    component: "AffiliateSpot",
    partners: ["bookshop"] as const,
  },
  {
    spot: "experiences" as const,
    route: "",
    section: "Experiences",
    component: "AffiliateSpot",
    partners: ["viator", "getyourguide"] as const,
  },
  {
    spot: "gifts" as const,
    route: "/shop?aisle=home-and-gifts",
    section: "Gifts",
    component: "AffiliateSpot",
    partners: ["zazzle"] as const,
  },
] as const;

export const AFFILIATE_OFFERS: readonly AffiliateOffer[] = [
  {
    id: "bookshop",
    network: "bookshop",
    spot: "books",
    href: "",
    label: AFFILIATE_WORDY.bookshopLink,
    partnerId: "",
    disclosure: AFFILIATE_DISCLOSURE,
  },
  {
    id: "viator",
    network: "viator",
    spot: "experiences",
    href: "",
    label: AFFILIATE_WORDY.viatorLink,
    partnerId: "P00330828",
    disclosure: AFFILIATE_DISCLOSURE,
  },
  {
    id: "getyourguide",
    network: "getyourguide",
    spot: "experiences",
    href: "",
    label: AFFILIATE_WORDY.getyourguideLink,
    partnerId: "YEH3QKQ",
    disclosure: AFFILIATE_DISCLOSURE,
  },
  {
    id: "zazzle",
    network: "zazzle",
    spot: "gifts",
    href: "",
    label: AFFILIATE_WORDY.zazzleLink,
    partnerId: "238672294015858667",
    disclosure: AFFILIATE_DISCLOSURE,
  },
];

export const AFFILIATE_SPOT_HEADING: Record<AffiliateSpot, string> = {
  books: AFFILIATE_WORDY.booksHeading,
  experiences: AFFILIATE_WORDY.experiencesHeading,
  gifts: AFFILIATE_WORDY.giftsHeading,
};

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
  return line || AFFILIATE_DISCLOSURE;
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
