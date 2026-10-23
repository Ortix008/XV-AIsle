import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-")), "market.sqlite");
delete process.env.SUPPLIER_API_URL;
delete process.env.SUPPLIER_API_KEY;

async function main() {
const { closeDb, getDb } = await import("../src/lib/server/db");
const { signIn, signUp } = await import("../src/lib/server/accounts");
const { createPendingOrder, fulfillPaidOrder, publicShopListing, publishListing } = await import("../src/lib/server/store");
const { requestShipment } = await import("../src/lib/server/supplier");
const { verifyStripeSignature } = await import("../src/lib/server/stripe");

const joined = signUp({ name: "Example Seller", email: "seller@example.com", password: "market-test" });
if ("error" in joined) throw new Error(joined.error);
const wrong = signIn({ email: "seller@example.com", password: "nope-nope" });
if (!("error" in wrong)) throw new Error("wrong password should fail");
const again = signIn({ email: "seller@example.com", password: "market-test" });
if ("error" in again) throw new Error(again.error);

const published = publishListing(joined.account.id, {
  productId: "sheet-pan",
  sku: "LN-PAN-Q",
  title: "Quarter sheet pan and rack",
  description: "One pan, one rack.",
  priceCents: 2695,
  image: "/art/mock-sheet-pan-1.png",
  supplierName: "Example Seller",
  supplierOrigin: "Elizabeth, NJ",
  shipDaysMin: 2,
  shipDaysMax: 4,
  supplierAccountId: joined.account.id,
  supplierCostCents: 500,
  route: "api",
});
if ("error" in published) throw new Error(published.error);

const pending = createPendingOrder({
  productId: "sheet-pan",
  qty: 1,
  ship: {
    name: "Example Buyer",
    email: "buyer@example.com",
    line1: "100 Example Street",
    city: "Sample City",
    region: "ST",
    postal: "00000",
    country: "US",
  },
});
if ("error" in pending) throw new Error(pending.error);
getDb().prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(pending.order.id);
const queued = await fulfillPaidOrder(pending.order.id);
if (queued?.status !== "queued") throw new Error(`expected queued, got ${queued?.status}`);

process.env.SUPPLIER_API_URL = "https://supplier.test/orders";
process.env.SUPPLIER_API_KEY = "test-key";
let sentBody = "";
const accepted = await requestShipment(
  {
    orderId: pending.order.id,
    number: pending.order.number,
    sku: "LN-PAN-Q",
    title: "Quarter sheet pan and rack",
    qty: 1,
    supplierName: "Northwharf Goods",
    shipTo: {
      name: "Example Buyer",
      email: "buyer@example.com",
      line1: "100 Example Street",
      city: "Sample City",
      region: "ST",
      postal: "00000",
      country: "US",
    },
  },
  {
    fetchImpl: async (_url, init) => {
      sentBody = String(init?.body ?? "");
      return new Response(JSON.stringify({ reference: "SUP-19" }), { status: 200 });
    },
  },
);
if (accepted.status !== "accepted" || accepted.ref !== "SUP-19") throw new Error("supplier should accept");
if (!sentBody.includes("LN-PAN-Q")) throw new Error("shipment body was wrong");

const header = "t=1,v1=dead";
if (verifyStripeSignature("{}", header, "secret")) throw new Error("bad signature should fail");

const { allowAttempt, clientBucket } = await import("../src/lib/server/rate-limit");
if (!allowAttempt("test:ip", 2, 60_000) || !allowAttempt("test:ip", 2, 60_000)) throw new Error("rate limit should allow two");
if (allowAttempt("test:ip", 2, 60_000)) throw new Error("rate limit should block the third");
const rateDb = getDb();
const agedHit = Date.now() - 20_000;
rateDb.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run("long:window", agedHit);
rateDb.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run("short:window", agedHit);
if (!allowAttempt("short:window", 5, 5_000)) throw new Error("a short window should allow a new hit");
const keptLong = rateDb.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ?").get("long:window") as { n: number };
if (keptLong.n !== 1) throw new Error("a short window must not delete another key's hits");
const staleShort = rateDb.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at < ?").get("short:window", Date.now() - 5_000) as {
  n: number;
};
if (staleShort.n !== 0) throw new Error("a key still drops its own expired hits");
delete process.env.TRUST_PROXY;
const spoofed = new Request("http://127.0.0.1/", { headers: { "x-forwarded-for": "1.2.3.4" } });
if (clientBucket(spoofed, "signin") !== null) throw new Error("forwarded header should be ignored");
process.env.TRUST_PROXY = "1";
const trusted = new Request("http://127.0.0.1/", { headers: { "x-forwarded-for": "9.9.9.9, 203.0.113.5" } });
if (clientBucket(trusted, "signin") !== "signin:203.0.113.5") throw new Error("expected the proxy hop");
delete process.env.TRUST_PROXY;

const { listFloorReach, saveFloorReach } = await import("../src/lib/server/floors");
const { reachNote } = await import("../src/lib/floors");
const badFloor = saveFloorReach(joined.account.id, { floorId: "nope", status: "open", contact: "" });
if (!("error" in badFloor)) throw new Error("unknown floor should fail");
const walmart = saveFloorReach(joined.account.id, {
  floorId: "walmart",
  status: "shipping",
  contact: "seller@walmart.example",
});
if ("error" in walmart) throw new Error(walmart.error);
if (walmart.floor.name !== "Walmart" || walmart.floor.status !== "shipping") throw new Error("walmart should ship");
const listed = listFloorReach(joined.account.id);
if (!listed.some((floor) => floor.id === "amazon" && floor.status === "open")) throw new Error("amazon should stay open");
const note = reachNote(walmart.floor, "https://xvaisle.com/shop");
if (!note.includes("https://xvaisle.com/shop") || !note.includes("Walmart") || !note.includes("made in the USA")) {
  throw new Error("reach note was wrong");
}
const { addSmallShop, listSmallShops } = await import("../src/lib/server/small-shops");
const shop = addSmallShop(joined.account.id, {
  name: "Harbor Towel Co",
  city: "Elizabeth, NJ",
  makes: "Heavy cotton towels",
  madeInUsa: true,
});
if ("error" in shop) throw new Error(shop.error);
if (!listSmallShops().some((item) => item.name === "Harbor Towel Co" && item.madeInUsa)) {
  throw new Error("small shop should be public");
}
const usaPage = publishListing(joined.account.id, {
  productId: "usa-towel",
  sku: "TWL-1",
  title: "Heavy cotton towel",
  description: "Made on a short run.",
  priceCents: 1800,
  image: "/art/mock-sheet-pan-1.png",
  supplierName: "Harbor Towel Co",
  supplierOrigin: "Elizabeth, NJ",
  shipDaysMin: 2,
  shipDaysMax: 4,
  madeInUsa: true,
  shelf: "small",
});
if ("error" in usaPage || !usaPage.listing) throw new Error("error" in usaPage ? usaPage.error : "towel missing");
const towel = {
  productId: "usa-towel",
  sku: "TWL-1",
  title: "Heavy cotton towel",
  description: "Made on a short run.",
  priceCents: 1800,
  image: "/art/mock-sheet-pan-1.png",
  supplierName: "Harbor Towel Co",
  supplierOrigin: "Elizabeth, NJ",
  shipDaysMin: 2,
  shipDaysMax: 4,
  madeInUsa: true as const,
  shelf: "small" as const,
};
const withOpen = publishListing(joined.account.id, {
  ...towel,
  shipsFrom: "Elizabeth, NJ",
  deliveryTime: "2–4 days",
  whyWePicked: "A short run from a small shop.",
});
if ("error" in withOpen || !withOpen.listing) throw new Error("open info should save");
if (
  withOpen.listing.shipsFrom !== "Elizabeth, NJ" ||
  withOpen.listing.deliveryTime !== "2–4 days" ||
  withOpen.listing.whyWePicked !== "A short run from a small shop."
) {
  throw new Error("open info should round-trip");
}
const publicTowel = publicShopListing(withOpen.listing, false);
if ("supplierCostCents" in publicTowel || "supplierShippingCents" in publicTowel || "feeBps" in publicTowel) {
  throw new Error("public listing should hide cost and margin");
}
if ("shipsFrom" in publicTowel || "supplierOrigin" in publicTowel || "origin" in publicTowel) {
  throw new Error("public listing should hide the place");
}
const kept = publishListing(joined.account.id, towel);
if ("error" in kept || kept.listing?.shipsFrom !== "Elizabeth, NJ") {
  throw new Error("open info should stay when a later save omits it");
}
const cleared = publishListing(joined.account.id, { ...towel, shipsFrom: "", deliveryTime: "   ", whyWePicked: "" });
if ("error" in cleared || cleared.listing?.shipsFrom || cleared.listing?.deliveryTime || cleared.listing?.whyWePicked) {
  throw new Error("blank open info should clear");
}
const huge = publishListing(joined.account.id, { ...towel, shipsFrom: "x".repeat(200) });
if (!("error" in huge)) throw new Error("a long ships-from should fail");
const { listPublished } = await import("../src/lib/server/store");
const usaOnly = listPublished({ madeInUsa: true });
if (!usaOnly.some((item) => item.productId === "usa-towel")) throw new Error("usa shelf should include the towel");
if (listPublished({ shelf: "small" }).some((item) => item.productId === "sheet-pan")) {
  throw new Error("sheet pan is not a small-business page");
}
const { xTimelinePost } = await import("../src/lib/floors");
const post = xTimelinePost({
  title: "Heavy cotton towel",
  price: "$18.00",
  url: "https://xvaisle.com/shop/usa-towel",
  madeInUsa: true,
});
if (
  post.length > 280 ||
  !post.includes("https://xvaisle.com/shop/usa-towel") ||
  !post.includes("#ad, I earn a commission.")
) {
  throw new Error("x post was wrong");
}
const { addInquiry } = await import("../src/lib/server/inquiries");
const inquiry = addInquiry({ name: "Example Buyer", email: "buyer@example.com", message: "The towel arrived late." });
if ("error" in inquiry) throw new Error(inquiry.error);
const badContact = saveFloorReach(joined.account.id, { floorId: "amazon", status: "talking", contact: "not-an-email" });
if (!("error" in badContact)) throw new Error("contact should be an email");

const remoteImage = publishListing(joined.account.id, {
  productId: "remote",
  sku: "X",
  title: "Remote picture",
  description: "no",
  priceCents: 1000,
  image: "https://example.com/a.png",
  supplierName: "Amazon",
  supplierOrigin: "US",
  shipDaysMin: 2,
  shipDaysMax: 4,
});
if (!("error" in remoteImage)) throw new Error("remote picture should fail");
const abroad = createPendingOrder({
  productId: "sheet-pan",
  qty: 1,
  ship: {
    name: "Example Buyer",
    email: "buyer@example.com",
    line1: "100 Example Street",
    city: "Sample City",
    region: "ST",
    postal: "00000",
    country: "CA",
  },
});
if (!("error" in abroad)) throw new Error("non-US order should fail");
const other = signUp({ name: "Second Seller", email: "seller2@example.com", password: "market-test" });
if ("error" in other) throw new Error(other.error);
const stolen = publishListing(other.account.id, {
  productId: "sheet-pan",
  sku: "LN-PAN-Q",
  title: "Quarter sheet pan and rack",
  description: "Taken.",
  priceCents: 2695,
  image: "/art/mock-sheet-pan-1.png",
  supplierName: "Northwharf Goods",
  supplierOrigin: "Elizabeth, NJ",
  shipDaysMin: 2,
  shipDaysMax: 4,
});
if (!("error" in stolen)) throw new Error("another account should not replace a page");
const { settleCheckoutSession } = await import("../src/lib/server/ledger");
const underpaid = await settleCheckoutSession({
  id: "cs_test_underpaid",
  url: null,
  status: "complete",
  payment_status: "paid",
  customer: null,
  subscription: null,
  amount_total: 100,
  metadata: { kind: "order", order_id: pending.order.id },
});
if (!("error" in underpaid)) throw new Error("underpaid session should not fulfill");
const { ensureStarterShelf } = await import("../src/lib/server/starter-shelf");
const { saveReturnsAddress, readReturnsAddress, saveSupportEmail, readSupportEmail, supportEmailForDisplay, PUBLISHED_SUPPORT_EMAIL } =
  await import("../src/lib/server/settings");
delete process.env.STORE_OPERATOR_EMAIL;
ensureStarterShelf();
if (getDb().prepare("SELECT product_id FROM listings WHERE product_id = 'bench-scraper'").get()) {
  throw new Error("example accounts should not receive the starter shelf");
}
const operator = signUp({ name: "Store Operator", email: "operator@xvaisle.test", password: "market-test" });
if ("error" in operator) throw new Error(operator.error);
ensureStarterShelf();
if (getDb().prepare("SELECT product_id FROM listings WHERE product_id = 'bench-scraper'").get()) {
  throw new Error("the first real account must not become the operator");
}
process.env.STORE_OPERATOR_EMAIL = "operator@xvaisle.test";
delete process.env.DEMO_SEED;
ensureStarterShelf();
if (getDb().prepare("SELECT product_id FROM listings WHERE product_id = 'bench-scraper' AND published = 1").get()) {
  throw new Error("sample products stay out of the shop unless DEMO_SEED=1");
}
process.env.DEMO_SEED = "1";
ensureStarterShelf();
const scraper = getDb().prepare("SELECT account_id, price_cents FROM listings WHERE product_id = 'bench-scraper'").get() as
  | { account_id: string; price_cents: number }
  | undefined;
if (!scraper || scraper.account_id !== operator.account.id || scraper.price_cents !== 895) {
  throw new Error("starter scraper should belong to the operator at $8.95");
}
const panOwner = getDb().prepare("SELECT account_id FROM listings WHERE product_id = 'sheet-pan'").get() as {
  account_id: string;
};
if (panOwner.account_id !== joined.account.id) throw new Error("existing sheet pan should stay with its owner");
delete process.env.DEMO_SEED;
ensureStarterShelf();
const hidden = getDb()
  .prepare("SELECT published FROM listings WHERE product_id = 'bench-scraper'")
  .get() as { published: number } | undefined;
if (hidden?.published !== 0) throw new Error("turning DEMO_SEED off unpublishes sample products");
const env = process.env as Record<string, string | undefined>;
const previousNode = env.NODE_ENV;
const previousVercel = env.VERCEL_ENV;
env.DEMO_SEED = "1";
env.NODE_ENV = "production";
delete env.VERCEL_ENV;
ensureStarterShelf();
const blocked = getDb().prepare("SELECT published FROM listings WHERE product_id = 'bench-scraper'").get() as {
  published: number;
};
if (blocked.published !== 0) throw new Error("DEMO_SEED does not publish samples in production");
env.VERCEL_ENV = "preview";
ensureStarterShelf();
const previewShelf = getDb().prepare("SELECT published FROM listings WHERE product_id = 'bench-scraper'").get() as {
  published: number;
};
if (previewShelf.published !== 1) throw new Error("DEMO_SEED publishes samples on a preview deploy");
delete env.DEMO_SEED;
ensureStarterShelf();
if (previousNode === undefined) delete env.NODE_ENV;
else env.NODE_ENV = previousNode;
if (previousVercel === undefined) delete env.VERCEL_ENV;
else env.VERCEL_ENV = previousVercel;
const closedShelf = getDb().prepare("SELECT published FROM listings WHERE product_id = 'bench-scraper'").get() as {
  published: number;
};
if (closedShelf.published !== 0) throw new Error("turning DEMO_SEED off unpublishes sample products");
const savedReturns = saveReturnsAddress("100 Example Street, Sample City, ST 00000");
if ("error" in savedReturns || readReturnsAddress() !== "100 Example Street, Sample City, ST 00000") {
  throw new Error("return address should save");
}
saveReturnsAddress("");
if (readReturnsAddress()) throw new Error("return address should clear");
const savedEmail = saveSupportEmail("support@example.com");
if ("error" in savedEmail || readSupportEmail() !== "support@example.com") throw new Error("support email should save");
const badEmail = saveSupportEmail("not-an-email");
if (!("error" in badEmail)) throw new Error("support email should reject a bad address");
saveSupportEmail("");
if (readSupportEmail()) throw new Error("support email should clear");
delete process.env.STORE_SUPPORT_EMAIL;
if (supportEmailForDisplay() !== PUBLISHED_SUPPORT_EMAIL) {
  throw new Error("an empty support email shows the published address");
}
if (PUBLISHED_SUPPORT_EMAIL !== "xvaisle.team@gmail.com") throw new Error("the published support email is xvaisle.team@gmail.com");
saveSupportEmail("support@example.com");
if (supportEmailForDisplay() !== "support@example.com") throw new Error("a saved support email replaces the published address");
saveSupportEmail("");
const resellerPage = readFileSync(join(process.cwd(), "src/app/shop/reseller/page.tsx"), "utf8");
if (!resellerPage.includes('title="Reseller program coming soon."')) {
  throw new Error("reseller page should say the program is coming soon");
}
if (resellerPage.includes("Earn with xvaisle") || resellerPage.includes("Resellers coming soon")) {
  throw new Error("reseller page should use the launch line");
}
if (
  resellerPage.includes("Join free") ||
  resellerPage.includes("Earn 5%") ||
  resellerPage.includes("no fee to open an account")
) {
  throw new Error("reseller page should not sell a live commission plan");
}
for (const sentence of ["We do not promise income.", "Buyers pay on xvaisle.com."]) {
  if (!resellerPage.includes(sentence)) throw new Error("honest reseller copy should stay");
}
const earnings =
  "We don't promise any amount you'll make. Full terms come when the reseller program opens.";
const termsPage = readFileSync(join(process.cwd(), "src/app/shop/reseller/terms/page.tsx"), "utf8");
for (const [file, source] of [
  ["reseller page", resellerPage],
  ["reseller terms", termsPage],
] as const) {
  if (source.includes("We do not quote example earnings")) throw new Error(`${file} still quotes example earnings`);
  if (!source.includes(earnings)) throw new Error(`${file} should use the approved earnings line`);
  if (!source.includes("We do not promise income. A listing can sell, or it can sell nothing.")) {
    throw new Error(`${file} should keep the sentences before the earnings line`);
  }
}
for (const file of ["src/components/policy-article.tsx", "src/app/shop/contact/page.tsx"]) {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  if (source.includes("A support email is not published yet")) throw new Error(`${file} still hides the support email`);
  if (!source.includes("mailto:")) throw new Error(`${file} should link the support email`);
}

closeDb();
console.log("market checks ok", { order: pending.order.number });
}

main();
