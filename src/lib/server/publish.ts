import { publishDenial } from "./access";
import type { PublicAccount } from "./accounts";
import { getAccount } from "./accounts";
import { connectReady, getConnected } from "./connect";
import { explicitFeeBps, quoteSplit, splitProblem } from "./fees";
import { publishListing } from "./store";

export type PublishBody = {
  productId: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  image: string;
  supplierName: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  published?: boolean;
  madeInUsa?: boolean;
  shelf?: string;
  supplierAccountId?: string | null;
  supplierCostCents?: number;
  supplierShippingCents?: number;
  feeBps?: number | null;
};

export function publishForAccount(account: PublicAccount, input: PublishBody) {
  const publishing = input.published !== false;
  const supplierAccountId = input.supplierAccountId?.trim() || null;
  const supplierCostCents = input.supplierCostCents ?? 0;
  const supplierShippingCents = input.supplierShippingCents ?? 0;
  let feeBps: number | null = null;
  if (input.feeBps != null) {
    const explicit = explicitFeeBps(input.feeBps);
    if (typeof explicit !== "number") return { status: 400 as const, error: explicit.error };
    feeBps = explicit;
  }
  if (publishing) {
    const denial = publishDenial(account, connectReady(getConnected(account.id)));
    if (denial) return { status: 403 as const, error: denial };
    if (!Number.isInteger(supplierCostCents) || !Number.isInteger(supplierShippingCents)) {
      return { status: 400 as const, error: "Supplier cost has to be a whole number of cents." };
    }
    const split = quoteSplit({
      priceCents: input.priceCents,
      qty: 1,
      supplierCostCents,
      supplierShippingCents,
      feeBps,
    });
    const problem = splitProblem(split, supplierAccountId);
    if (problem) return { status: 400 as const, error: problem };
    if (!supplierAccountId || !getAccount(supplierAccountId)) {
      return { status: 400 as const, error: "That supplier account is not on this market." };
    }
    if (!connectReady(getConnected(supplierAccountId))) {
      return { status: 400 as const, error: "The supplier has not finished payout setup." };
    }
  }
  const result = publishListing(account.id, {
    productId: input.productId,
    sku: input.sku,
    title: input.title,
    description: input.description,
    priceCents: input.priceCents,
    image: input.image,
    supplierName: input.supplierName,
    supplierOrigin: input.supplierOrigin,
    shipDaysMin: input.shipDaysMin,
    shipDaysMax: input.shipDaysMax,
    published: input.published,
    madeInUsa: input.madeInUsa,
    shelf: input.shelf === "small" ? "small" : "national",
    supplierAccountId,
    supplierCostCents,
    supplierShippingCents,
    feeBps,
  });
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, listing: result.listing };
}
