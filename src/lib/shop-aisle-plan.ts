/** Proposed aisle tags for the eight live shop products. The rows live in the database, not in seed code. */
export const SHOP_AISLE_PLAN = [
  {
    productId: "10-piece-magnetic-bag-clip-set",
    aisle: "home-and-gifts",
    reason: "Bag clips belong with home and kitchen goods.",
  },
  {
    productId: "6-inch-yoga-wheel",
    aisle: "everyday-finds",
    reason: "A small piece of workout gear.",
  },
  {
    productId: "beagle-luau-kitchen-towel",
    aisle: "home-and-gifts",
    reason: "A kitchen towel for the house.",
  },
  {
    productId: "cell-phone-lanyard",
    aisle: "tech-and-desk",
    reason: "A phone carry for the desk and the day.",
  },
  {
    productId: "clear-crystal-arrowhead-suncatcher",
    aisle: "home-and-gifts",
    reason: "A decorative gift for the home.",
  },
  {
    productId: "corgi-luau-kitchen-towel",
    aisle: "home-and-gifts",
    reason: "A kitchen towel for the house.",
  },
  {
    productId: "pet-seat-belt-tether",
    aisle: "everyday-finds",
    reason: "A small tether for the road.",
  },
  {
    productId: "yoga-pilates-ring",
    aisle: "everyday-finds",
    reason: "A small piece of workout gear.",
  },
] as const;

export type AisleRow = { product_id: string; aisle: string | null };

export function planAisleUpdates(rows: readonly AisleRow[]) {
  return SHOP_AISLE_PLAN.map((plan) => {
    const row = rows.find((item) => item.product_id === plan.productId);
    if (!row) return { ...plan, action: "missing" as const };
    if (row.aisle === plan.aisle) return { ...plan, action: "unchanged" as const };
    return { ...plan, action: "update" as const, from: row.aisle };
  });
}
