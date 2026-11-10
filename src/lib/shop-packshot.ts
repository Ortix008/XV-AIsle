/**
 * White-background pack shots blend into the cream plate.
 * A listing field wins when it is set. Anything else stays off.
 */
export const SHOP_PACKSHOTS = {
  "10-piece-magnetic-bag-clip-set": true,
  "pet-seat-belt-tether": true,
  "beagle-luau-kitchen-towel": true,
  "corgi-luau-kitchen-towel": true,
  "cell-phone-lanyard": true,
  "6-inch-yoga-wheel": false,
  "clear-crystal-arrowhead-suncatcher": false,
  "yoga-pilates-ring": false,
} as const;

export function productIsPackshot(productId: string, listing?: { packshot?: boolean | null }) {
  if (typeof listing?.packshot === "boolean") return listing.packshot;
  return SHOP_PACKSHOTS[productId as keyof typeof SHOP_PACKSHOTS] ?? false;
}
