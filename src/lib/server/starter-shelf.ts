import { charm, landedCost, suggestRetail, TARGET_MARGIN } from "../money";
import { getDb } from "./db";
import { getListing, publishListing } from "./store";

const SAMPLE_IDS = new Set(["sheet-pan", "bench-scraper"]);

export function demoSeedEnabled() {
  return process.env.DEMO_SEED === "1";
}

export function isSampleListing(listing: { productId: string; supplierName: string }) {
  return SAMPLE_IDS.has(listing.productId) && listing.supplierName === "Northwharf Goods";
}

/** Sample rows stay out of the public shop unless DEMO_SEED=1. */
export function visibleOnShop(listing: { productId: string; supplierName: string; published: boolean }) {
  if (!listing.published) return false;
  if (isSampleListing(listing) && !demoSeedEnabled()) return false;
  return true;
}

type Starter = {
  productId: string;
  sku: string;
  title: string;
  description: string;
  image: string;
  supplierName: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  unitCost: number;
  inboundShipping: number;
  packaging: number;
};

const starters: Starter[] = [
  {
    productId: "sheet-pan",
    sku: "LN-PAN-Q",
    title: "Quarter sheet pan and rack",
    description: "One pan, one rack. The rack keeps the chicken out of the fat.",
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    unitCost: 11,
    inboundShipping: 0,
    packaging: 1.2,
  },
  {
    productId: "bench-scraper",
    sku: "LN-SCR-1",
    title: "Stainless bench scraper",
    description: "Cut dough, lift chopped onion, scrape the board into the pan.",
    image: "/art/mock-bench-scraper-1.png",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    unitCost: 3.4,
    inboundShipping: 0,
    packaging: 0.35,
  },
];

function shelfOperatorId() {
  const preferred = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase();
  if (!preferred) return null;
  const row = getDb().prepare("SELECT id FROM accounts WHERE email = ?").get(preferred) as { id: string } | undefined;
  return row?.id ?? null;
}

function priceCents(item: Starter) {
  const landed = landedCost(item);
  return Math.round(charm(suggestRetail(landed, TARGET_MARGIN)) * 100);
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
  for (const item of starters) {
    if (getListing(item.productId)) continue;
    publishListing(accountId, {
      productId: item.productId,
      sku: item.sku,
      title: item.title,
      description: item.description,
      priceCents: priceCents(item),
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
