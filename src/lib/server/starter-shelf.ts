import { charm, landedCost, suggestRetail, TARGET_MARGIN } from "../money";
import { getDb } from "./db";
import { getListing, publishListing } from "./store";

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
  const db = getDb();
  const preferred = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase();
  if (preferred) {
    const row = db.prepare("SELECT id FROM accounts WHERE email = ?").get(preferred) as { id: string } | undefined;
    return row?.id ?? null;
  }
  const rows = db.prepare("SELECT id, email FROM accounts ORDER BY created_at").all() as {
    id: string;
    email: string;
  }[];
  const real = rows.filter((row) => !row.email.endsWith("@example.com"));
  if (real.length === 1) return real[0].id;
  return null;
}

function priceCents(item: Starter) {
  const landed = landedCost(item);
  return Math.round(charm(suggestRetail(landed, TARGET_MARGIN)) * 100);
}

/** Publish the two US-warehouse pages when one real account owns the store. */
export function ensureStarterShelf() {
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
