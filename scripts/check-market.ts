import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-")), "market.sqlite");
delete process.env.SUPPLIER_API_URL;
delete process.env.SUPPLIER_API_KEY;

async function main() {
const { closeDb, getDb } = await import("../src/lib/server/db");
const { signIn, signUp } = await import("../src/lib/server/accounts");
const { createPendingOrder, fulfillPaidOrder, publishListing } = await import("../src/lib/server/store");
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
  supplierName: "Northwharf Goods",
  supplierOrigin: "Elizabeth, NJ",
  shipDaysMin: 2,
  shipDaysMax: 4,
  supplierAccountId: joined.account.id,
  supplierCostCents: 500,
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
delete process.env.TRUST_PROXY;
const spoofed = new Request("http://127.0.0.1/", { headers: { "x-forwarded-for": "1.2.3.4" } });
if (clientBucket(spoofed, "signin") !== "signin:local") throw new Error("forwarded header should be ignored");
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
if ("error" in usaPage) throw new Error(usaPage.error);
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
if (post.length > 280 || !post.includes("https://xvaisle.com/shop/usa-towel")) throw new Error("x post was wrong");
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
const { saveReturnsAddress, readReturnsAddress } = await import("../src/lib/server/settings");
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
const savedReturns = saveReturnsAddress("100 Example Street, Sample City, ST 00000");
if ("error" in savedReturns || readReturnsAddress() !== "100 Example Street, Sample City, ST 00000") {
  throw new Error("return address should save");
}
saveReturnsAddress("");
if (readReturnsAddress()) throw new Error("return address should clear");

closeDb();
console.log("market checks ok", { order: pending.order.number });
}

main();
