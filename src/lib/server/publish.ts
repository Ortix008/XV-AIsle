import { publishDenial } from "./access";
import type { PublicAccount } from "./accounts";
import { getAccount } from "./accounts";
import { getApprovedCatalog } from "./catalog";
import { connectReady, getConnected } from "./connect";
import { platformFeeBps, quoteSplit, saleBlock } from "./fees";
import { resellerDebtCents } from "./ledger";
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
  /** Ignored. The server uses PLATFORM_FEE_BPS. */
  feeBps?: number | null;
  /** Ignored. The server recomputes the split. */
  platformFeeCents?: number | null;
  stripeFeeCents?: number | null;
  resellerAmountCents?: number | null;
  supplierAmountCents?: number | null;
};

export type PriceQuote = {
  priceCents: number;
  supplierCostCents: number;
  platformFeeCents: number;
  stripeFeeCents: number;
  resellerNetCents: number;
  error: string | null;
};

export function quoteForAccount(input: { catalogItemId: string; priceCents: number }) {
  const item = input.catalogItemId ? getApprovedCatalog(input.catalogItemId) : null;
  if (!item) return { status: 400 as const, error: "Choose a supplier-approved catalog item." };
  if (!Number.isInteger(input.priceCents)) return { status: 400 as const, error: "Set a price before the store can sell it." };
  const split = quoteSplit({
    priceCents: input.priceCents,
    qty: 1,
    supplierCostCents: item.costCents,
    supplierShippingCents: item.shippingCents,
    feeBps: platformFeeBps(),
  });
  const quote: PriceQuote = {
    priceCents: input.priceCents,
    supplierCostCents: split.supplierAmountCents,
    platformFeeCents: split.platformFeeCents,
    stripeFeeCents: split.stripeFeeCents,
    resellerNetCents: split.resellerAmountCents,
    error: saleBlock({ priceCents: input.priceCents, split, supplierAccountId: item.accountId }),
  };
  return { status: 200 as const, quote };
}

export function publishForAccount(account: PublicAccount, input: PublishBody) {
  const publishing = input.published !== false;
  const feeBps = platformFeeBps();
  const existing = getListing(input.productId);
  let supplierAccountId = existing?.supplierAccountId ?? null;
  let supplierCostCents = existing?.supplierCostCents ?? 0;
  let supplierShippingCents = existing?.supplierShippingCents ?? 0;
  let catalogItemId = existing?.catalogItemId ?? null;
  let supplierName = input.supplierName;
  let supplierOrigin = input.supplierOrigin;
  if (publishing) {
    const denial = publishDenial(account, connectReady(getConnected(account.id)));
    if (denial) return { status: 403 as const, error: denial };
    if (resellerDebtCents(account.id) > 0) {
      return {
        status: 400 as const,
        error: "Publishing is paused until your open balance is paid down.",
      };
    }
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
    catalogItemId = item.id;
    supplierName = supplier.name;
    supplierOrigin = item.origin;
    const split = quoteSplit({
      priceCents: input.priceCents,
      qty: 1,
      supplierCostCents,
      supplierShippingCents,
      feeBps,
    });
    const problem = saleBlock({ priceCents: input.priceCents, split, supplierAccountId });
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
    feeBps: publishing ? feeBps : (existing?.feeBps ?? feeBps),
    catalogItemId,
  });
  if ("error" in result) return { status: 400 as const, error: result.error };
  return { status: 200 as const, listing: result.listing };
}
