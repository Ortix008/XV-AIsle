export const FEE_RATE = 0.029;
export const FEE_FIXED = 0.3;
export const AD_RATE = 0.12;
export const TARGET_MARGIN = 0.38;

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function landedCost(quote: {
  unitCost: number;
  inboundShipping: number;
  packaging: number;
}) {
  return round2(quote.unitCost + quote.inboundShipping + quote.packaging);
}

export function suggestRetail(landed: number, targetMargin: number) {
  const denom = 1 - FEE_RATE - AD_RATE - targetMargin;
  if (denom <= 0.05) return landed * 4;
  return (landed + FEE_FIXED) / denom;
}

export function netMargin(retail: number, landed: number) {
  if (retail <= 0) return 0;
  const fees = retail * FEE_RATE + FEE_FIXED;
  const ads = retail * AD_RATE;
  return (retail - landed - fees - ads) / retail;
}

export function costStack(retail: number, landed: number) {
  const fees = round2(retail * FEE_RATE + FEE_FIXED);
  const ads = round2(retail * AD_RATE);
  const profit = round2(retail - landed - fees - ads);
  return { fees, ads, profit, margin: netMargin(retail, landed) };
}

/** Price ending in .95, not below the margin target by more than $0.20. */
export function charm(raw: number) {
  const base = Math.floor(raw);
  const min = raw - 0.2;
  const options = [base - 0.05, base + 0.95, base + 1.95].filter((n) => n >= min);
  const pick = options.sort((a, b) => a - b)[0] ?? base + 0.95;
  return round2(pick);
}

export function money(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}
