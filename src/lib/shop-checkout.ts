import { qaCheckoutBlockedOnShelf } from "./qa-checkout";
import { shopCardShowsPrice, showShopPrices } from "./shop-prices";
import { isHeldSample, isScentedCandleListing, isWoodTrayListing } from "./shelf-holds";
import { comingSoonListing } from "./supplier-confirm";

type CheckoutListing = {
  productId: string;
  title?: string | null;
  priceCents?: number | null;
  supplierName?: string | null;
  shipsFrom?: string | null;
  supplierUsConfirmed?: boolean | null;
  sample?: boolean | null;
  supplierAccountId?: string | null;
};

/**
 * A shopper cannot open checkout while the card would say Coming soon,
 * or while the listing itself cannot be bought.
 */
export function shopperCheckoutClosed(listing: CheckoutListing | null | undefined, pricesOn = showShopPrices()) {
  if (!listing) return true;
  if (!shopCardShowsPrice(listing.priceCents, pricesOn)) return true;
  if (isWoodTrayListing(listing) || isScentedCandleListing(listing) || isHeldSample(listing)) return true;
  if (qaCheckoutBlockedOnShelf(listing)) return true;
  return comingSoonListing(listing);
}
