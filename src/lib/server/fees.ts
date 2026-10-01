/**
 * Platform cut for separate charges and transfers.
 * The buyer pays the listed price. Stripe processing is collected by the platform
 * (Accounts v2 fees_collector = application) and then taken out of the reseller's share,
 * so the platform keeps its full fee. The estimate is replaced by the charge's
 * balance-transaction fee when Stripe returns one.
 *
 * Hold window: Stripe does not provide escrow. A US platform may hold funds before transfer or
 * payout for up to 2 years (other countries 90 days, Thailand 10 days). This store ships in the
 * US, so the deadline is 730 days from payment. See Stripe's holding-funds guidance.
 *
 * TODO: if the platform country is not the US, replace US_TRANSFER_HOLD_MS. Many countries
 * allow 90 days, and Thailand allows 10 days. Do not reuse 730 days outside the US.
 *
 * Buyer shipping is not charged as its own line. Gross is the listing price times quantity.
 * Supplier shipping is added once per order, not once per unit.
 */

export const FEE_BPS_MIN = 800;
export const FEE_BPS_MAX = 1200;
export const FEE_BPS_DEFAULT = 1000;
export const STRIPE_FEE_BPS_MIN = 0;
export const STRIPE_FEE_BPS_MAX = 1000;
export const STRIPE_FEE_BPS_DEFAULT = 290;
export const STRIPE_FEE_FIXED_MIN = 0;
export const STRIPE_FEE_FIXED_MAX = 100;
export const STRIPE_FEE_FIXED_DEFAULT = 30;
export const STRIPE_DISPUTE_FEE_MIN = 0;
export const STRIPE_DISPUTE_FEE_MAX = 3500;
export const STRIPE_DISPUTE_FEE_DEFAULT = 1500;
export const MIN_RETAIL_MIN = 100;
export const MIN_RETAIL_MAX = 100_000;
export const MIN_RETAIL_DEFAULT = 500;
export const MIN_RESELLER_NET_MIN = 0;
export const MIN_RESELLER_NET_MAX = 5000;
export const MIN_RESELLER_NET_DEFAULT = 50;
export const RESELLER_RESERVE_BPS_MIN = 0;
export const RESELLER_RESERVE_BPS_MAX = 10000;
export const RESELLER_RESERVE_BPS_DEFAULT = 1000;
export const RESELLER_RESERVE_DAYS_MIN = 1;
export const RESELLER_RESERVE_DAYS_MAX = 3650;
export const RESELLER_RESERVE_DAYS_DEFAULT = 120;
export const RESELLER_RESERVE_CAP_MIN = 0;
export const RESELLER_RESERVE_CAP_MAX = 100_000_000;
export const RESELLER_RESERVE_CAP_DEFAULT = 10000;
export const US_TRANSFER_HOLD_MS = 730 * 24 * 60 * 60 * 1000;
export const TRANSFER_HOLD_WARNING_MS = 14 * 24 * 60 * 60 * 1000;
export const BUYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const FULFILL_TIMEOUT_MS = 15 * 60 * 1000;

export type Split = {
  grossCents: number;
  feeBps: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  supplierAmountCents: number;
  resellerAmountCents: number;
};

export type HoldState = "none" | "open" | "nearing" | "expired";

export type Clawback = {
  supplierReverseCents: number;
  resellerReverseCents: number;
  debtCents: number;
  feeRecoveredCents: number;
};

function clampedInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function dollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function platformFeeBps() {
  return clampedInt(process.env.PLATFORM_FEE_BPS, FEE_BPS_DEFAULT, FEE_BPS_MIN, FEE_BPS_MAX);
}

export function stripeFeeBps() {
  return clampedInt(process.env.STRIPE_FEE_BPS, STRIPE_FEE_BPS_DEFAULT, STRIPE_FEE_BPS_MIN, STRIPE_FEE_BPS_MAX);
}

export function stripeFeeFixedCents() {
  return clampedInt(process.env.STRIPE_FEE_FIXED_CENTS, STRIPE_FEE_FIXED_DEFAULT, STRIPE_FEE_FIXED_MIN, STRIPE_FEE_FIXED_MAX);
}

export function stripeDisputeFeeCents() {
  return clampedInt(
    process.env.STRIPE_DISPUTE_FEE_CENTS,
    STRIPE_DISPUTE_FEE_DEFAULT,
    STRIPE_DISPUTE_FEE_MIN,
    STRIPE_DISPUTE_FEE_MAX,
  );
}

export function minRetailCents() {
  return clampedInt(process.env.MIN_RETAIL_CENTS, MIN_RETAIL_DEFAULT, MIN_RETAIL_MIN, MIN_RETAIL_MAX);
}

export function minResellerNetCents() {
  return clampedInt(
    process.env.MIN_RESELLER_NET_CENTS,
    MIN_RESELLER_NET_DEFAULT,
    MIN_RESELLER_NET_MIN,
    MIN_RESELLER_NET_MAX,
  );
}

export function resellerReserveBps() {
  return clampedInt(
    process.env.RESELLER_RESERVE_BPS,
    RESELLER_RESERVE_BPS_DEFAULT,
    RESELLER_RESERVE_BPS_MIN,
    RESELLER_RESERVE_BPS_MAX,
  );
}

export function resellerReserveDays() {
  return clampedInt(
    process.env.RESELLER_RESERVE_DAYS,
    RESELLER_RESERVE_DAYS_DEFAULT,
    RESELLER_RESERVE_DAYS_MIN,
    RESELLER_RESERVE_DAYS_MAX,
  );
}

export function resellerReserveCapCents() {
  return clampedInt(
    process.env.RESELLER_RESERVE_CAP_CENTS,
    RESELLER_RESERVE_CAP_DEFAULT,
    RESELLER_RESERVE_CAP_MIN,
    RESELLER_RESERVE_CAP_MAX,
  );
}

/** Portion of this payout kept on the platform, capped by the reseller's remaining room. */
export function reserveHoldCents(input: { payoutCents: number; heldCents: number; bps: number; capCents: number }) {
  if (input.payoutCents <= 0 || input.bps <= 0 || input.capCents <= 0) return 0;
  const room = Math.max(0, input.capCents - Math.max(0, input.heldCents));
  const desired = Math.round((input.payoutCents * input.bps) / 10000);
  return Math.min(input.payoutCents, room, Math.max(0, desired));
}

export function explicitFeeBps(value: number): number | { error: string } {
  if (!Number.isInteger(value) || value < FEE_BPS_MIN || value > FEE_BPS_MAX) {
    return { error: "The platform fee has to stay between 8% and 12%." };
  }
  return value;
}

export function estimateStripeFee(grossCents: number) {
  return Math.round((grossCents * stripeFeeBps()) / 10000) + stripeFeeFixedCents();
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
  const stripeFeeCents = estimateStripeFee(grossCents);
  const supplierAmountCents = input.supplierCostCents * input.qty + input.supplierShippingCents;
  const resellerAmountCents = grossCents - platformFeeCents - supplierAmountCents - stripeFeeCents;
  return { grossCents, feeBps, platformFeeCents, stripeFeeCents, supplierAmountCents, resellerAmountCents };
}

/** Replace the estimate with the fee Stripe reported on the charge. Platform and supplier amounts stay put. */
export function splitWithStripeFee(split: Split, actualStripeFeeCents: number): Split {
  if (!Number.isInteger(actualStripeFeeCents) || actualStripeFeeCents < 0) return split;
  const resellerAmountCents =
    split.grossCents - split.platformFeeCents - split.supplierAmountCents - actualStripeFeeCents;
  return { ...split, stripeFeeCents: actualStripeFeeCents, resellerAmountCents };
}

export function splitProblem(split: Split, supplierAccountId: string | null) {
  if (!supplierAccountId) return "Name the supplier account before this page can sell.";
  if (split.supplierAmountCents < 0) return "Supplier cost cannot be negative.";
  if (split.resellerAmountCents < 0) {
    return "The price does not cover the supplier, the platform fee, and the Stripe fee.";
  }
  return null;
}

export function saleBlock(input: { priceCents: number; split: Split; supplierAccountId: string | null }) {
  if (!Number.isInteger(input.priceCents) || input.priceCents < minRetailCents()) {
    return `Set a price of at least ${dollars(minRetailCents())}.`;
  }
  const problem = splitProblem(input.split, input.supplierAccountId);
  if (problem) return problem;
  if (input.split.resellerAmountCents < minResellerNetCents()) {
    return `Your estimated payout has to be at least ${dollars(minResellerNetCents())} after supplier cost and fees.`;
  }
  return null;
}

/** Share of an amount, proportional to `part` of `gross`, capped at the amount. */
export function proportion(amount: number, part: number, gross: number) {
  if (gross <= 0 || part <= 0 || amount <= 0) return 0;
  if (part >= gross) return amount;
  return Math.min(amount, Math.round((amount * part) / gross));
}

/**
 * Supplier recovery stays proportional to the refund.
 * The reseller also gives back the platform fee and the original Stripe fee on that portion.
 * Anything the reseller's balance cannot cover becomes debt.
 */
export function refundClawback(input: {
  grossCents: number;
  refundedCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  supplierAmountCents: number;
  resellerAmountCents: number;
}): Clawback {
  const supplierReverseCents = proportion(input.supplierAmountCents, input.refundedCents, input.grossCents);
  const platformShare = proportion(input.platformFeeCents, input.refundedCents, input.grossCents);
  const stripeShare = proportion(input.stripeFeeCents, input.refundedCents, input.grossCents);
  const resellerGoods = proportion(input.resellerAmountCents, input.refundedCents, input.grossCents);
  const feeRecoveredCents = platformShare + stripeShare;
  const need = resellerGoods + feeRecoveredCents;
  const resellerReverseCents = Math.min(Math.max(0, input.resellerAmountCents), need);
  return {
    supplierReverseCents,
    resellerReverseCents,
    debtCents: need - resellerReverseCents,
    feeRecoveredCents,
  };
}

/** Same as a refund of the disputed amount, plus the flat dispute fee Stripe charges. */
export function disputeClawback(input: {
  grossCents: number;
  disputedCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  supplierAmountCents: number;
  resellerAmountCents: number;
  disputeFeeCents: number;
}): Clawback {
  const base = refundClawback({
    grossCents: input.grossCents,
    refundedCents: input.disputedCents,
    platformFeeCents: input.platformFeeCents,
    stripeFeeCents: input.stripeFeeCents,
    supplierAmountCents: input.supplierAmountCents,
    resellerAmountCents: input.resellerAmountCents,
  });
  const disputeFee = Math.max(0, input.disputeFeeCents);
  const room = Math.max(0, input.resellerAmountCents - base.resellerReverseCents);
  const fromBalance = Math.min(room, disputeFee);
  return {
    supplierReverseCents: base.supplierReverseCents,
    resellerReverseCents: base.resellerReverseCents + fromBalance,
    debtCents: base.debtCents + (disputeFee - fromBalance),
    feeRecoveredCents: base.feeRecoveredCents + disputeFee,
  };
}

/**
 * Cash on the platform after Stripe's fee, refunds, a lost dispute, and the shares
 * supplier and reseller still keep. Reseller debt is not included. It is a receivable
 * until a later payout or reserve actually collects it.
 */
export function platformCashCents(input: {
  grossCents: number;
  stripeFeeCents: number;
  refundedCents: number;
  disputeKeptCents: number;
  disputeFeeKeptCents: number;
  supplierKeptCents: number;
  resellerKeptCents: number;
}) {
  return (
    input.grossCents -
    input.stripeFeeCents -
    input.refundedCents -
    input.disputeKeptCents -
    input.disputeFeeKeptCents -
    input.supplierKeptCents -
    input.resellerKeptCents
  );
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
