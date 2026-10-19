import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  QA_CHECKOUT_PRODUCT_ID,
  QA_SUPPLIER_EMAIL,
  qaCheckoutBlockedOnShelf,
  qaCheckoutSeedAllowed,
} from "../src/lib/qa-checkout";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-qa-")), "qa.sqlite");
const previousStripe = process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.DEMO_SEED;
delete process.env.VERCEL_ENV;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function mainGuard() {
  assert(qaCheckoutSeedAllowed({}) === false, "the fixture stays off without DEMO_SEED");
  assert(qaCheckoutSeedAllowed({ DEMO_SEED: "1" }) === true, "DEMO_SEED=1 allows the fixture outside production");
  assert(
    qaCheckoutSeedAllowed({ DEMO_SEED: "1", NODE_ENV: "production" }) === false,
    "production does not seed the fixture",
  );
  assert(
    qaCheckoutSeedAllowed({ DEMO_SEED: "1", VERCEL_ENV: "production" }) === false,
    "a production deploy does not seed the fixture",
  );
  assert(
    qaCheckoutSeedAllowed({ DEMO_SEED: "1", NODE_ENV: "production", VERCEL_ENV: "production" }) === false,
    "DEMO_SEED cannot publish the fixture on the live shelf",
  );
  assert(
    qaCheckoutSeedAllowed({ DEMO_SEED: "1", NODE_ENV: "production", VERCEL_ENV: "preview" }) === true,
    "preview may seed the fixture",
  );
  const listing = { productId: QA_CHECKOUT_PRODUCT_ID };
  assert(qaCheckoutBlockedOnShelf(listing, { DEMO_SEED: "1", NODE_ENV: "production" }), "live shelf blocks the fixture");
  assert(!qaCheckoutBlockedOnShelf(listing, { DEMO_SEED: "1", VERCEL_ENV: "preview" }), "preview does not block the fixture");
  assert(!qaCheckoutBlockedOnShelf({ productId: "sheet-pan" }, { NODE_ENV: "production" }), "the guard is only the QA listing");
}

async function main() {
  mainGuard();
  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { createPendingOrder, getListing, publicShopListing, publishListing } = await import("../src/lib/server/store");
  const { ensureStarterShelf, visibleOnShop } = await import("../src/lib/server/starter-shelf");
  const { setStripeFetch } = await import("../src/lib/server/stripe");
  const { POST } = await import("../src/app/api/store/checkout/route");

  const env = process.env as Record<string, string | undefined>;
  getDb()
    .prepare(
      `INSERT INTO accounts (
         id, name, email, password_hash, password_salt, created_at, role, email_verified
       ) VALUES ('qa-operator-test', 'QA Operator', 'operator@xvaisle.test', '00', '00', ?, 'buyer', 1)`,
    )
    .run(Date.now());
  env.STORE_OPERATOR_EMAIL = "operator@xvaisle.test";

  const ship = {
    productId: QA_CHECKOUT_PRODUCT_ID,
    qty: 1,
    name: "Test Buyer",
    email: "buyer@example.com",
    line1: "100 Example Street",
    city: "Sample City",
    region: "ST",
    postal: "00000",
    country: "US",
  };

  env.DEMO_SEED = "1";
  delete env.VERCEL_ENV;
  env.NODE_ENV = "development";
  ensureStarterShelf();
  const seeded = getListing(QA_CHECKOUT_PRODUCT_ID);
  assert(seeded?.published, "preview seed publishes the QA listing");
  assert(Boolean(seeded?.supplierAccountId), "the QA listing has a test supplier account");
  const supplier = getDb().prepare("SELECT id, role, email FROM accounts WHERE email = ?").get(QA_SUPPLIER_EMAIL) as
    | { id: string; role: string; email: string }
    | undefined;
  assert(supplier?.role === "supplier" && supplier.id === seeded?.supplierAccountId, "the supplier account is the test supplier");
  assert(
    visibleOnShop({
      productId: QA_CHECKOUT_PRODUCT_ID,
      supplierName: "QA Test Supplier",
      published: true,
    }),
    "the fixture is visible while the demo shelf is on",
  );
  const pending = createPendingOrder({ productId: ship.productId, qty: ship.qty, ship });
  if ("error" in pending) throw new Error(pending.error);
  assert(pending.order.supplierAccountId === supplier?.id, "checkout keeps the test supplier");

  const { isHeldSample } = await import("../src/lib/shelf-holds");
  const { QA_TEST_BANNER, SAMPLE_UNAVAILABLE } = await import("../src/lib/shelf-copy");
  assert(QA_TEST_BANNER === "Test mode. No real money moves on this page.", "the test banner is the approved line");
  assert(SAMPLE_UNAVAILABLE === "Not available yet. Check back soon.", "the sample note is the approved line");
  const sheet = getListing("sheet-pan");
  const scraper = getListing("bench-scraper");
  if (!sheet || !scraper || !isHeldSample(sheet) || !isHeldSample(scraper)) {
    throw new Error("the seeded samples stay held");
  }
  assert(sheet.supplierAccountId == null && scraper.supplierAccountId == null, "seeded samples are not linked to a supplier account");
  assert(sheet.supplierName === "Northwharf Goods", "the database still knows the seeded supplier");
  const shownSheet = publicShopListing(sheet, true);
  assert(shownSheet.supplierName === "" && shownSheet.supplierOrigin === "", "the shopper listing drops the seeded supplier");
  const heldOrder = createPendingOrder({ productId: "sheet-pan", qty: 1, ship });
  assert("error" in heldOrder, "checkout refuses a sample with no real supplier");
  assert(getListing("sheet-pan")?.published === true, "refusing the sample does not delete it");
  assert(
    isHeldSample({ productId: "sheet-pan", supplierName: "Northwharf Goods", supplierAccountId: "linked-account" }),
    "the sample marker holds a sheet pan even when an account is linked",
  );
  assert(
    isHeldSample({ productId: "bench-scraper", supplierName: "Northwharf Goods", supplierAccountId: "linked-account" }),
    "the sample marker holds the bench scraper even when an account is linked",
  );
  assert(
    isHeldSample({
      productId: QA_CHECKOUT_PRODUCT_ID,
      supplierName: "QA Test Supplier",
      supplierAccountId: supplier?.id,
    }) === false,
    "qa-checkout stays buyable",
  );
  getDb()
    .prepare("UPDATE listings SET supplier_account_id = ? WHERE product_id IN ('sheet-pan', 'bench-scraper')")
    .run(supplier?.id);
  const linkedSheet = getListing("sheet-pan");
  const linkedScraper = getListing("bench-scraper");
  if (!linkedSheet || !linkedScraper || !isHeldSample(linkedSheet) || !isHeldSample(linkedScraper)) {
    throw new Error("a sample stays held when an account is linked");
  }
  assert(publicShopListing(linkedSheet, true).supplierName === "", "a linked sample still hides the supplier");
  const linkedOrder = createPendingOrder({ productId: "sheet-pan", qty: 1, ship });
  const linkedScraperOrder = createPendingOrder({ productId: "bench-scraper", qty: 1, ship });
  assert("error" in linkedOrder && "error" in linkedScraperOrder, "checkout refuses a sample that has a supplier account");
  assert(getListing("sheet-pan")?.published === true, "refusing a linked sample does not unpublish it");
  ensureStarterShelf();
  assert(getListing("sheet-pan")?.supplierAccountId == null, "the shelf clears a linked sheet pan account");
  assert(getListing("bench-scraper")?.supplierAccountId == null, "the shelf clears a linked bench scraper account");
  const qaKept = getListing(QA_CHECKOUT_PRODUCT_ID);
  assert(qaKept?.published === true && qaKept.supplierAccountId === supplier?.id, "qa-checkout keeps its test supplier");
  const qaStill = createPendingOrder({ productId: QA_CHECKOUT_PRODUCT_ID, qty: 1, ship });
  if ("error" in qaStill) throw new Error(qaStill.error);

  const wood = publishListing("qa-operator-test", {
    productId: "serving-board",
    sku: "QA-TRY-1",
    title: "Wood Tray",
    description: "A tray.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "QA Test Supplier",
    supplierOrigin: "Sample City, ST",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: supplier?.id,
    supplierCostCents: 500,
  });
  if ("error" in wood) throw new Error(wood.error);
  ensureStarterShelf();
  const tray = getListing("serving-board");
  if (!tray || tray.published !== false) throw new Error("Wood Tray is unpublished on boot");
  assert(tray.title === "Wood Tray", "Wood Tray is kept, not deleted");
  getDb().prepare("UPDATE listings SET published = 1 WHERE product_id = ?").run("serving-board");
  assert(
    visibleOnShop({ productId: "serving-board", title: "Wood Tray", supplierName: "QA Test Supplier", published: true }) === false,
    "Wood Tray stays off the shelf even if the row is marked published",
  );
  const trayOrder = createPendingOrder({ productId: "serving-board", qty: 1, ship });
  assert("error" in trayOrder, "checkout refuses Wood Tray");
  assert(getListing("serving-board"), "the Wood Tray row is still in the database");

  env.STRIPE_SECRET_KEY = "sk_test_qa_shelf";
  setStripeFetch(async () =>
    Response.json({
      id: "cs_test_qa_checkout",
      url: "https://checkout.stripe.com/c/pay/cs_test_qa_checkout",
    }),
  );
  const response = await POST(
    new Request("http://127.0.0.1/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ship),
    }),
  );
  const body = (await response.json()) as { url?: string; error?: string };
  assert(response.ok && body.url === "https://checkout.stripe.com/c/pay/cs_test_qa_checkout", body.error ?? "test checkout did not open");
  setStripeFetch(null);

  delete env.DEMO_SEED;
  ensureStarterShelf();
  const hidden = getListing(QA_CHECKOUT_PRODUCT_ID);
  assert(hidden?.published === false, "turning DEMO_SEED off unpublishes the fixture");
  getDb().prepare("UPDATE listings SET published = 1 WHERE product_id = ?").run(QA_CHECKOUT_PRODUCT_ID);
  assert(
    visibleOnShop({
      productId: QA_CHECKOUT_PRODUCT_ID,
      supplierName: "QA Test Supplier",
      published: true,
    }) === false,
    "a published fixture row stays off the shelf when the seed is off",
  );
  const leaked = createPendingOrder({ productId: ship.productId, qty: ship.qty, ship });
  assert("error" in leaked, "checkout refuses the fixture when the seed is off");

  env.DEMO_SEED = "1";
  env.NODE_ENV = "production";
  delete env.VERCEL_ENV;
  ensureStarterShelf();
  const live = getListing(QA_CHECKOUT_PRODUCT_ID);
  assert(live?.published === false, "production unpublishes the fixture even when DEMO_SEED=1");
  assert(
    qaCheckoutBlockedOnShelf({ productId: QA_CHECKOUT_PRODUCT_ID }, env),
    "the live-shelf guard stays closed in production",
  );
  getDb().prepare("UPDATE listings SET published = 1 WHERE product_id = ?").run(QA_CHECKOUT_PRODUCT_ID);
  const liveOrder = createPendingOrder({ productId: ship.productId, qty: ship.qty, ship });
  assert("error" in liveOrder, "production checkout refuses the fixture");

  env.VERCEL_ENV = "preview";
  ensureStarterShelf();
  const preview = getListing(QA_CHECKOUT_PRODUCT_ID);
  assert(preview?.published === true && Boolean(preview.supplierAccountId), "preview publishes the sellable fixture");

  env.VERCEL_ENV = "production";
  ensureStarterShelf();
  const closed = getListing(QA_CHECKOUT_PRODUCT_ID);
  assert(closed?.published === false, "a production deploy unpublishes the fixture");

  if (previousStripe === undefined) delete env.STRIPE_SECRET_KEY;
  else env.STRIPE_SECRET_KEY = previousStripe;
  closeDb();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "QA shelf check failed";
  console.error(message);
  process.exit(1);
});
