import { usSupplierConfirmed } from "../order-facts";
import { RETURNS_EMAILED } from "../return-address";
import { samplePriceCents, sampleStarters } from "../sample-shelf";
import { getDb } from "./db";
import { getListing, publishListing } from "./store";

const SAMPLE_IDS = new Set(["sheet-pan", "bench-scraper"]);

/** Preview and local checks only. Production never seeds, even when the flag is set. */
export function demoSeedEnabled() {
  if (process.env.DEMO_SEED !== "1") return false;
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview") return false;
  return true;
}

export function isSampleListing(listing: { productId: string; supplierName: string }) {
  return SAMPLE_IDS.has(listing.productId) && listing.supplierName === "Northwharf Goods";
}

/** Unconfirmed preview samples use the emailed return line. Confirmed listings keep their own. */
export function sampleProductReturnNote(
  listing: {
    productId: string;
    supplierName: string;
    shipsFrom?: string | null;
    supplierUsConfirmed?: boolean | null;
  },
  fallback: string,
) {
  if (demoSeedEnabled() && isSampleListing(listing) && !usSupplierConfirmed(listing)) return RETURNS_EMAILED;
  return fallback;
}

/** Sample rows stay out of the public shop unless DEMO_SEED=1. */
export function visibleOnShop(listing: {
  productId: string;
  supplierName: string;
  published: boolean;
  hiddenFromShop?: boolean;
}) {
  if (!listing.published || listing.hiddenFromShop) return false;
  if (isSampleListing(listing) && !demoSeedEnabled()) return false;
  return true;
}

function shelfOperatorId() {
  const preferred = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase();
  if (!preferred) return null;
  const row = getDb().prepare("SELECT id FROM accounts WHERE email = ?").get(preferred) as { id: string } | undefined;
  return row?.id ?? null;
}

/** Publish the two sample pages only when DEMO_SEED=1 and an operator account exists. */
export function ensureStarterShelf() {
  if (!demoSeedEnabled()) {
    getDb()
      .prepare(
        "UPDATE listings SET published = 0 WHERE product_id IN ('sheet-pan', 'bench-scraper') AND supplier_name = 'Northwharf Goods'",
      )
      .run();
    return;
  }
  const accountId = shelfOperatorId();
  if (!accountId) return;
  for (const item of sampleStarters) {
    if (getListing(item.productId)) {
      getDb()
        .prepare(
          "UPDATE listings SET published = 1 WHERE product_id = ? AND supplier_name = 'Northwharf Goods' AND published = 0",
        )
        .run(item.productId);
      continue;
    }
    publishListing(accountId, {
      productId: item.productId,
      sku: item.sku,
      title: item.title,
      description: item.description,
      priceCents: samplePriceCents(item),
      image: item.image,
      supplierName: item.supplierName,
      supplierOrigin: item.supplierOrigin,
      shipDaysMin: item.shipDaysMin,
      shipDaysMax: item.shipDaysMax,
      madeInUsa: false,
      shelf: "national",
    });
  }
}
