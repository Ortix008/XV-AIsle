import { RAINCOAT_HOLD, raincoatHeld } from "./size-chart";

/** Confirmed garnet variety. Empty until the stone is identified. */
export const GARNET_TYPE: string | null = null;

export const GARNET_PRODUCT_ID = "garnet-jewelry-gift-set";

export const GARNET_HOLD = "This garnet set stays unpublished until the garnet type is confirmed.";

const LIVE_LATER = new Set(["pearl-jewelry-gift-set", "christmas-tree-cat-house-flag"]);

export function garnetHeld(productId: string) {
  return productId === GARNET_PRODUCT_ID && GARNET_TYPE == null;
}

export function draftPublishError(productId: string) {
  if (raincoatHeld(productId)) return RAINCOAT_HOLD;
  if (garnetHeld(productId)) return GARNET_HOLD;
  return null;
}

export function eligibleToPublishLater(productId: string) {
  return LIVE_LATER.has(productId) && draftPublishError(productId) == null;
}
