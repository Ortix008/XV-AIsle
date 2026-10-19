import { usSupplierConfirmed } from "../order-facts";
import { QA_CHECKOUT_PRODUCT_ID, QA_SUPPLIER_EMAIL, isQaCheckoutListing, qaCheckoutSeedAllowed } from "../qa-checkout";
import { RETURNS_EMAILED } from "../return-address";
import { samplePriceCents, sampleStarters } from "../sample-shelf";
import { getDb } from "./db";
import { platformFeeBps, quoteSplit, saleBlock } from "./fees";
import { getListing, publishListing } from "./store";

const SAMPLE_IDS = new Set(["sheet-pan", "bench-scraper"]);

/** Preview and local checks only. Production never seeds, even when the flag is set. */
export function demoSeedEnabled() {
  return qaCheckoutSeedAllowed(process.env);
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
  if (isQaCheckoutListing(listing) && !demoSeedEnabled()) return false;
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
    getDb().prepare("UPDATE listings SET published = 0 WHERE product_id = ?").run(QA_CHECKOUT_PRODUCT_ID);
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
  ensureQaCheckoutListing(accountId);
}

const QA_PRICE_CENTS = 2695;
const QA_SUPPLIER_COST_CENTS = 500;

/** Not a password. Sign-in rejects a hash of the wrong length. */
const UNUSABLE_PASSWORD = "00";

function ensureQaSupplier() {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(QA_SUPPLIER_EMAIL) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE accounts SET role = 'supplier', name = 'QA Test Supplier' WHERE id = ?").run(existing.id);
    return existing.id;
  }
  const id = "qa-supplier-test";
  db.prepare(
    `INSERT INTO accounts (
       id, name, email, password_hash, password_salt, created_at, role, email_verified
     ) VALUES (?, 'QA Test Supplier', ?, ?, ?, ?, 'supplier', 1)`,
  ).run(id, QA_SUPPLIER_EMAIL, UNUSABLE_PASSWORD, UNUSABLE_PASSWORD, Date.now());
  return id;
}

/** A sellable TEST listing. Seeded only while the demo shelf is on, and unpublished otherwise. */
function ensureQaCheckoutListing(operatorId: string) {
  const supplierId = ensureQaSupplier();
  const split = quoteSplit({
    priceCents: QA_PRICE_CENTS,
    qty: 1,
    supplierCostCents: QA_SUPPLIER_COST_CENTS,
    supplierShippingCents: 0,
    feeBps: platformFeeBps(),
  });
  if (saleBlock({ priceCents: QA_PRICE_CENTS, split, supplierAccountId: supplierId })) return;
  const existing = getListing(QA_CHECKOUT_PRODUCT_ID);
  if (existing && existing.accountId !== operatorId) {
    getDb().prepare("UPDATE listings SET account_id = ? WHERE product_id = ?").run(operatorId, QA_CHECKOUT_PRODUCT_ID);
  }
  publishListing(operatorId, {
    productId: QA_CHECKOUT_PRODUCT_ID,
    sku: "QA-CHK-1",
    title: "QA checkout fixture",
    description: "A test listing for Stripe test-mode checkout. Not a real product.",
    priceCents: QA_PRICE_CENTS,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "QA Test Supplier",
    supplierOrigin: "Sample City, ST",
    shipDaysMin: 2,
    shipDaysMax: 4,
    madeInUsa: false,
    shelf: "national",
    supplierAccountId: supplierId,
    supplierCostCents: QA_SUPPLIER_COST_CENTS,
    supplierShippingCents: 0,
    published: true,
  });
}
