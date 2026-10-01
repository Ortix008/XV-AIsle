/**
 * Platform cut for separate charges and transfers.
 * Stripe processing fees are paid by the platform (Accounts v2 fees_collector = application).
 * They are not subtracted again from the reseller or supplier. The retained cut has to cover them.
 *
 * Hold window: Stripe does not provide escrow. A US platform may hold funds before transfer or
 * payout for up to 2 years (other countries 90 days, Thailand 10 days). This store ships in the
 * US, so the deadline is 730 days from payment. See Stripe's holding-funds guidance.
 *
 * TODO: if the platform country is not the US, replace US_TRANSFER_HOLD_MS. Many countries
 * allow 90 days, and Thailand allows 10 days. Do not reuse 730 days outside the US.
 */

export const FEE_BPS_MIN = 800;
export const FEE_BPS_MAX = 1200;
export const FEE_BPS_DEFAULT = 1000;
export const US_TRANSFER_HOLD_MS = 730 * 24 * 60 * 60 * 1000;
export const TRANSFER_HOLD_WARNING_MS = 14 * 24 * 60 * 60 * 1000;
export const BUYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const FULFILL_TIMEOUT_MS = 15 * 60 * 1000;

export type Split = {
  grossCents: number;
  feeBps: number;
  platformFeeCents: number;
  supplierAmountCents: number;
  resellerAmountCents: number;
};

export type HoldState = "none" | "open" | "nearing" | "expired";

export function platformFeeBps() {
  const raw = process.env.PLATFORM_FEE_BPS?.trim();
  if (!raw) return FEE_BPS_DEFAULT;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) return FEE_BPS_DEFAULT;
  return Math.min(FEE_BPS_MAX, Math.max(FEE_BPS_MIN, parsed));
}

export function explicitFeeBps(value: number): number | { error: string } {
  if (!Number.isInteger(value) || value < FEE_BPS_MIN || value > FEE_BPS_MAX) {
    return { error: "The platform fee has to stay between 8% and 12%." };
  }
  return value;
}

export function quoteSplit(input: {
  priceCents: number;
  qty: number;
  supplierCostCents: number;
  supplierShippingCents: number;
  feeBps: number | null;
}): Split {
  const feeBps = input.feeBps ?? platformFeeBps();
  const grossCents = input.priceCents * input.qty;
  const platformFeeCents = Math.round((grossCents * feeBps) / 10000);
  const supplierAmountCents = input.supplierCostCents * input.qty + input.supplierShippingCents;
  const resellerAmountCents = grossCents - platformFeeCents - supplierAmountCents;
  return { grossCents, feeBps, platformFeeCents, supplierAmountCents, resellerAmountCents };
}

export function splitProblem(split: Split, supplierAccountId: string | null) {
  if (!supplierAccountId) return "Name the supplier account before this page can sell.";
  if (split.supplierAmountCents < 0) return "Supplier cost cannot be negative.";
  if (split.resellerAmountCents < 0) return "The price does not cover the supplier and the platform fee.";
  return null;
}

export function holdDeadline(paidAt: number) {
  return paidAt + US_TRANSFER_HOLD_MS;
}

export function holdState(paidAt: number | null, now = Date.now()): HoldState {
  if (!paidAt) return "none";
  const deadline = holdDeadline(paidAt);
  if (now >= deadline) return "expired";
  if (now >= deadline - TRANSFER_HOLD_WARNING_MS) return "nearing";
  return "open";
}
