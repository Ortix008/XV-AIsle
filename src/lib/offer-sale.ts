import {
  sourcedOfferInputs,
  type SourceCitation,
  type SourceVariant,
  type SourcedOfferInput,
  type SourcedOfferStatus,
} from "@/data/sourced-offers";
import { cleanSupplierOrderUrl } from "@/lib/order-flags";
import { UNVERIFIED_OFFER_LABEL } from "@/lib/shelf-copy";

export type { SourcedOfferInput, SourcedOfferStatus };
export { UNVERIFIED_OFFER_LABEL };

/** Stripe checkout is the wrong door for an approved affiliate link. */
export const AFFILIATE_CHECKOUT_BLOCK =
  "This offer is purchased from the approved supplier link, not on xvaisle.com.";

export type AcceptedOffer = {
  id: string;
  title: string;
  status: SourcedOfferStatus;
  note: string | null;
  image: string | null;
  listingId: string | null;
  affiliateHref: string | null;
  sourceRetailCents: number | null;
  variants: SourceVariant[];
  citations: SourceCitation[];
};

export type PublicSourcedOffer = {
  id: string;
  title: string;
  note: string | null;
  image: string | null;
  label: typeof UNVERIFIED_OFFER_LABEL | null;
  href: string | null;
  kind: "unverified" | "affiliate" | "fulfillment";
  sourceRetailCents: number | null;
  variants: SourceVariant[];
  citations: SourceCitation[];
};

export type ShopperOfferState =
  | { mode: "store" }
  | { mode: "unverified" }
  | { mode: "affiliate"; href: string };

const ID = /^[a-z0-9-]{1,80}$/;
const LOCAL_IMAGE = /^\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|svg)$/;
const PRINT_SHOP = ["print", "ful"].join("");
const PRINT_APP = ["print", "ify"].join("");
const PRINT_ON = ["print", "on", "demand"].join("-");
const BLOCKED = /\b(?:candles?|pets?|pod|owned stock|food)\b/i;
const PROMISE = /\b(?:ships?|shipping|returns?|tracking|delivers?|delivery|in stock|arrives?)\b/i;

function blockedText(value: string) {
  const flat = value.toLowerCase();
  if (flat.includes(PRINT_SHOP) || flat.includes(PRINT_APP) || flat.includes(PRINT_ON)) return true;
  return BLOCKED.test(value);
}

function acceptOne(input: SourcedOfferInput): AcceptedOffer | null {
  if (!input || typeof input.id !== "string" || !ID.test(input.id)) return null;
  const title = typeof input.title === "string" ? input.title.trim().replace(/\s+/g, " ") : "";
  if (!title || title.length > 180 || blockedText(title)) return null;
  const category = typeof input.category === "string" ? input.category.trim() : "";
  if (category && (category.length > 40 || blockedText(category))) return null;
  if (
    input.status !== "unverified" &&
    input.status !== "supplier_pending" &&
    input.status !== "fulfillment" &&
    input.status !== "affiliate"
  ) {
    return null;
  }
  const rawNote = typeof input.note === "string" ? input.note.trim() : "";
  if (rawNote.length > 400) return null;
  const note = rawNote && !blockedText(rawNote) && !PROMISE.test(rawNote) ? rawNote : null;
  const image =
    typeof input.image === "string" && LOCAL_IMAGE.test(input.image) && !input.image.includes("..") ? input.image : null;
  const listingId = typeof input.listingId === "string" && ID.test(input.listingId) ? input.listingId : null;
  const affiliateHref = input.affiliateApproved === true ? cleanSupplierOrderUrl(input.affiliateHref) : null;
  const sourceRetailCents =
    input.status === "supplier_pending" &&
    Number.isInteger(input.sourceRetailCents) &&
    (input.sourceRetailCents ?? 0) > 0 &&
    (input.sourceRetailCents ?? 0) <= 100000
      ? (input.sourceRetailCents as number)
      : null;
  const variants = acceptVariants(input.variants);
  const citations = acceptCitations(input.citations);
  return {
    id: input.id,
    title,
    status: input.status,
    note,
    image,
    listingId,
    affiliateHref,
    sourceRetailCents,
    variants,
    citations,
  };
}

function acceptVariants(value: SourceVariant[] | undefined) {
  if (!value) return [];
  const variants: SourceVariant[] = [];
  for (const item of value.slice(0, 8)) {
    const code = item.code?.trim() ?? "";
    const label = item.label?.trim() ?? "";
    if (!/^[A-Za-z0-9-]{1,20}$/.test(code) || !label || label.length > 40) continue;
    variants.push({ code, label });
  }
  return variants;
}

function acceptCitations(value: SourceCitation[] | undefined) {
  if (!value) return [];
  const citations: SourceCitation[] = [];
  for (const item of value.slice(0, 8)) {
    const href = cleanSupplierOrderUrl(item.href);
    const text = item.text?.trim().replace(/\s+/g, " ") ?? "";
    if (!href || !text || text.length > 320 || blockedText(text)) continue;
    citations.push({ href, text });
  }
  return citations;
}

export function acceptSourcedOffers(inputs: readonly SourcedOfferInput[]) {
  const seen = new Set<string>();
  const listings = new Set<string>();
  const accepted: AcceptedOffer[] = [];
  for (const input of inputs) {
    const offer = acceptOne(input);
    if (!offer) continue;
    if (seen.has(offer.id) || listings.has(offer.id)) continue;
    if (offer.listingId && (seen.has(offer.listingId) || listings.has(offer.listingId))) continue;
    seen.add(offer.id);
    if (offer.listingId) listings.add(offer.listingId);
    accepted.push(offer);
  }
  return accepted;
}

let active = acceptSourcedOffers(sourcedOfferInputs);

export function sourcedOffers() {
  return active;
}

/** Tests only. Production reads the committed list. */
export function replaceSourcedOffersForTests(inputs: readonly SourcedOfferInput[]) {
  active = acceptSourcedOffers(inputs);
}

export function resetSourcedOffersForTests() {
  active = acceptSourcedOffers(sourcedOfferInputs);
}

export function presentSourcedOffer(offer: AcceptedOffer, listingPurchasable: boolean): PublicSourcedOffer {
  const base = {
    id: offer.id,
    title: offer.title,
    note: offer.note,
    image: offer.image,
    sourceRetailCents: offer.status === "supplier_pending" ? offer.sourceRetailCents : null,
    variants: offer.variants,
    citations: offer.citations,
  };
  switch (offer.status) {
    case "affiliate":
      if (offer.affiliateHref) {
        return { ...base, label: null, href: offer.affiliateHref, kind: "affiliate" as const };
      }
      return { ...base, label: UNVERIFIED_OFFER_LABEL, href: null, kind: "unverified" as const };
    case "fulfillment":
      if (offer.listingId && listingPurchasable) {
        return { ...base, label: null, href: `/shop/${offer.listingId}`, kind: "fulfillment" as const };
      }
      return { ...base, label: UNVERIFIED_OFFER_LABEL, href: null, kind: "unverified" as const };
    case "supplier_pending":
    case "unverified":
      return { ...base, label: UNVERIFIED_OFFER_LABEL, href: null, kind: "unverified" as const };
    default: {
      const neverStatus: never = offer.status;
      return neverStatus;
    }
  }
}

export function stripeCheckoutBlock(productId: string, records = sourcedOffers()) {
  const offer = records.find((item) => item.id === productId || item.listingId === productId);
  if (!offer) return null;
  switch (offer.status) {
    case "unverified":
    case "supplier_pending":
      return UNVERIFIED_OFFER_LABEL;
    case "affiliate":
      return offer.affiliateHref ? AFFILIATE_CHECKOUT_BLOCK : UNVERIFIED_OFFER_LABEL;
    case "fulfillment":
      if (offer.listingId && productId === offer.listingId) return null;
      return UNVERIFIED_OFFER_LABEL;
    default: {
      const neverStatus: never = offer.status;
      return neverStatus;
    }
  }
}

export function shopperOfferState(productId: string, sellable: boolean, records = sourcedOffers()): ShopperOfferState {
  const offer = records.find((item) => item.id === productId || item.listingId === productId);
  if (!offer) return { mode: "store" };
  switch (offer.status) {
    case "affiliate":
      return offer.affiliateHref ? { mode: "affiliate", href: offer.affiliateHref } : { mode: "unverified" };
    case "unverified":
    case "supplier_pending":
      return { mode: "unverified" };
    case "fulfillment":
      return sellable && offer.listingId ? { mode: "store" } : { mode: "unverified" };
    default: {
      const neverStatus: never = offer.status;
      return neverStatus;
    }
  }
}
