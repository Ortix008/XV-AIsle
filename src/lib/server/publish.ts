import { publishDenial } from "./access";
import type { PublicAccount } from "./accounts";
import { getAccount } from "./accounts";
import { getApprovedCatalog } from "./catalog";
import { connectReady, getConnected } from "./connect";
import { explicitFeeBps, quoteSplit, splitProblem } from "./fees";
import { getListing, publishListing } from "./store";

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
  catalogItemId?: string | null;
  feeBps?: number | null;
};

export function publishForAccount(account: PublicAccount, input: PublishBody) {
  const publishing = input.published !== false;
  let feeBps: number | null = null;
  if (input.feeBps != null) {
    const explicit = explicitFeeBps(input.feeBps);
    if (typeof explicit !== "number") return { status: 400 as const, error: explicit.error };
    feeBps = explicit;
  }
  const existing = getListing(input.productId);
  let supplierAccountId = existing?.supplierAccountId ?? null;
  let supplierCostCents = existing?.supplierCostCents ?? 0;
  let supplierShippingCents = existing?.supplierShippingCents ?? 0;
  let supplierName = input.supplierName;
  let supplierOrigin = input.supplierOrigin;
  if (feeBps == null && input.feeBps == null) feeBps = existing?.feeBps ?? null;
  if (publishing) {
    const denial = publishDenial(account, connectReady(getConnected(account.id)));
    if (denial) return { status: 403 as const, error: denial };
    const item = input.catalogItemId ? getApprovedCatalog(input.catalogItemId) : null;
    if (!item) return { status: 400 as const, error: "Choose a supplier-approved catalog item." };
    const supplier = getAccount(item.accountId);
    if (!supplier || supplier.role !== "supplier") {
      return { status: 400 as const, error: "That catalog item is not from a supplier account." };
    }
    if (supplier.id === account.id) {
      return { status: 400 as const, error: "You cannot be the supplier on your own listing." };
    }
    if (!connectReady(getConnected(supplier.id))) {
      return { status: 400 as const, error: "The supplier has not finished payout setup." };
    }
    supplierAccountId = supplier.id;
    supplierCostCents = item.costCents;
    supplierShippingCents = item.shippingCents;
    supplierName = supplier.name;
    supplierOrigin = item.origin;
    const split = quoteSplit({
      priceCents: input.priceCents,
      qty: 1,
      supplierCostCents,
      supplierShippingCents,
      feeBps,
    });
    const problem = splitProblem(split, supplierAccountId);
    if (problem) return { status: 400 as const, error: problem };
  }
  const result = publishListing(account.id, {
    productId: input.productId,
    sku: input.sku,
    title: input.title,
    description: input.description,
    priceCents: input.priceCents,
    image: input.image,
    supplierName,
    supplierOrigin,
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
