/** Garment measurements from the source. Empty until a chart is in hand. */
export type SizeChart = {
  source: string;
};

export const SOURCED_SIZE_CHART: SizeChart | null = null;

const RAINCOAT_IDS = new Set(["insulated-dog-raincoat-dark-blue", "reversible-dog-raincoat-green"]);

export const RAINCOAT_HOLD = "This raincoat stays unpublished until a sourced size chart exists.";

export function raincoatHeld(productId: string) {
  return RAINCOAT_IDS.has(productId) && SOURCED_SIZE_CHART == null;
}
