import { presentSourcedOffer, shopperOfferState, sourcedOffers, stripeCheckoutBlock } from "@/lib/offer-sale";
import { isHeldSample } from "@/lib/shelf-holds";
import { comingSoonListing } from "@/lib/supplier-confirm";
import { getListing, listingLoss, type StoreListing } from "@/lib/server/store";

/** A listing may be sold here only when the existing supplier, payout, and ship-from gates already pass. */
export function listingMaySell(listing: StoreListing) {
  if (!listing.published || listing.hiddenFromShop) return false;
  if (comingSoonListing(listing) || isHeldSample(listing)) return false;
  if (!listing.supplierAccountId) return false;
  if (listingLoss(listing)) return false;
  if (stripeCheckoutBlock(listing.productId)) return false;
  return true;
}

export function publicSourcedOffers() {
  return sourcedOffers().map((offer) => {
    const listing = offer.listingId ? getListing(offer.listingId) : null;
    return presentSourcedOffer(offer, Boolean(listing && listingMaySell(listing)));
  });
}

export function shopperOfferForListing(listing: StoreListing) {
  return shopperOfferState(listing.productId, listingMaySell(listing));
}
