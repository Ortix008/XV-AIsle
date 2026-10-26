import { createElement } from "react";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { buyerShareHref } from "../src/lib/x-share";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-money-")), "market.sqlite");
process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
delete process.env.RESELLER_COMMISSION_BPS;
delete process.env.PLATFORM_FEE_BPS;
delete process.env.STRIPE_FEE_BPS;
delete process.env.STRIPE_FEE_FIXED_CENTS;
delete process.env.MIN_RETAIL_CENTS;
delete process.env.STRIPE_ALLOW_LIVE;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const ship = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};

const DAY = 24 * 60 * 60 * 1000;
const PRIVATE_WORDS = ["wholesale_cost", "wholesaleCost", "supplierCostCents", "supplier_cost_cents", "8642", "7351"];

function assertPrivate(label: string, text: string) {
  for (const word of PRIVATE_WORDS) {
    assert(!text.includes(word), `${label} contains ${word}`);
  }
}

async function main() {
  const { signUp } = await import("../src/lib/server/accounts");
  const { getDb } = await import("../src/lib/server/db");
  const { estimateStripeFee } = await import("../src/lib/server/fees");
  const {
    attachReferrer,
    commissionFor,
    debtsFor,
    marginGuard,
    orderMoney,
    recordPaidSale,
    resellerCommissionBps,
    runMonthlyBatch,
    saveWholesaleCost,
    voidResellerCommission,
  } = await import("../src/lib/server/money-flow");
  const { applyDisputeOpened, applyRefund } = await import("../src/lib/server/ledger");
  const { buyerOrder, presentOrder, publicListing, resellerListing } = await import("../src/lib/server/order-view");
  const { referralFromCookieHeader } = await import("../src/lib/referral");
  const { setStripeFetch } = await import("../src/lib/server/stripe");
  const { createPendingOrder, getListing, getOrder, listingLoss, publishListing } = await import("../src/lib/server/store");
  const { ProductBuy } = await import("../src/components/product-buy");

  assert(resellerCommissionBps() === 500, "commission defaults to 5%");
  assert(referralFromCookieHeader("xv_ref=not-an-id") == null, "a ref cookie has to be an account id");
  assert(marginGuard(499, 0)?.includes("$5.00"), "a price under $5 is blocked");
  assert(
    marginGuard(2000, 1900) === "This price does not cover wholesale cost, the card fee, and commission.",
    "a negative margin is blocked",
  );

  const resellerJoin = signUp({ name: "Money Reseller", email: "money-reseller@example.com", password: "example-pass" });
  const adminJoin = signUp({ name: "Money Operator", email: "money-operator@example.com", password: "example-pass" });
  const buyerJoin = signUp({ name: "Money Buyer", email: "money-buyer@example.com", password: "example-pass" });
  const reseller = "account" in resellerJoin ? resellerJoin.account : undefined;
  const admin = "account" in adminJoin ? adminJoin.account : undefined;
  const buyer = "account" in buyerJoin ? buyerJoin.account : undefined;
  if (!reseller || !admin || !buyer) throw new Error("account");
  getDb().prepare("UPDATE accounts SET role = 'reseller', email_verified = 1 WHERE id = ?").run(reseller.id);
  getDb().prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(admin.id);
  reseller.role = "reseller";
  reseller.emailVerified = true;
  admin.role = "admin";
  admin.emailVerified = true;

  const page = {
    sku: "MONEY",
    title: "Money pan",
    description: "One pan.",
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Example Goods",
    supplierOrigin: "US",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: "supplier-money",
    supplierCostCents: 200,
    priceCents: 2000,
  };
  const listed = publishListing(admin.id, { ...page, productId: "money-pan" });
  if ("error" in listed) throw new Error(listed.error);
  const wholesale = saveWholesaleCost(admin, "money-pan", 400);
  assert(wholesale.status === 200, "an operator can save a wholesale cost that still clears one cent");
  const denied = saveWholesaleCost(reseller, "money-pan", 100);
  assert(denied.status === 403, "a reseller cannot save a wholesale cost");
  const negative = saveWholesaleCost(admin, "money-pan", 1900);
  assert(negative.status === 400, "a wholesale cost that loses money is rejected");
  assert(getListing("money-pan")?.wholesaleCost === 400, "a rejected wholesale cost is not stored");
  const cheap = publishListing(admin.id, { ...page, productId: "money-pan", priceCents: 499 });
  assert("error" in cheap && typeof cheap.error === "string" && cheap.error.includes("$5.00"), "activating under $5 is blocked once wholesale is set");
  assert(getListing("money-pan")?.priceCents === 2000, "the blocked price is not saved");

  const forced = publishListing(admin.id, {
    ...page,
    productId: "forced-pan",
    priceCents: 2000,
    supplierCostCents: 200,
  });
  if ("error" in forced) throw new Error(forced.error);
  getDb().prepare("UPDATE listings SET wholesale_cost = 1900 WHERE product_id = 'forced-pan'").run();
  assert(listingLoss(getListing("forced-pan")!) != null, "a stored negative margin stays off the shop");
  const forcedOrder = createPendingOrder({ productId: "forced-pan", qty: 1, ship });
  assert("error" in forcedOrder, "checkout blocks a negative-margin product");

  function sell(productId: string, qty = 1) {
    const created = createPendingOrder({ productId, qty, ship });
    if ("error" in created) throw new Error(created.error);
    return created.order;
  }

  function pay(orderId: string, chargeId: string) {
    getDb()
      .prepare("UPDATE orders SET status = 'paid', paid_at = ?, charge_id = ? WHERE id = ?")
      .run(Date.now(), chargeId, orderId);
    recordPaidSale(orderId);
  }

  const stripe = estimateStripeFee(2000);
  assert(stripe === 88, "the $20 card fee is 2.9% plus 30 cents");

  const direct = sell("money-pan");
  pay(direct.id, "ch_direct");
  const directMoney = orderMoney(direct.id);
  assert(directMoney?.commission_cents === 0, "a sale with no reseller books no commission");
  assert(directMoney?.wholesale_total_cents === 400, "the supplier is owed the wholesale cost");
  assert(directMoney?.platform_margin_cents === 2000 - 400 - stripe, "the platform keeps price minus wholesale minus the card fee");
  assert(commissionFor(direct.id) == null, "no reseller means no commission row");

  const referred = sell("money-pan");
  attachReferrer(referred.id, "not-a-ref");
  attachReferrer(referred.id, buyer.id);
  attachReferrer(referred.id, reseller.id);
  pay(referred.id, "ch_ref");
  const referredMoney = orderMoney(referred.id);
  const referredCommission = commissionFor(referred.id);
  assert(referredCommission?.status === "pending", "a reseller sale accrues as pending");
  assert(referredCommission?.amount_cents === 100, "commission is 5% of the item price");
  assert(referredCommission?.rate_bps === 500, "the sale stores the 5% rate");
  assert(referredMoney?.referrer_account_id === reseller.id, "the sale stores the reseller");
  assert(
    referredMoney?.platform_margin_cents === 2000 - 400 - stripe - 100,
    "commission comes out of the platform margin",
  );
  const pair = sell("money-pan", 2);
  attachReferrer(pair.id, reseller.id);
  pay(pair.id, "ch_pair");
  assert(commissionFor(pair.id)?.amount_cents === 200, "commission uses the item price times quantity, not shipping");
  assert(orderMoney(pair.id)?.item_price_cents === 4000, "the commission base excludes shipping and tax");

  const early = sell("money-pan");
  attachReferrer(early.id, reseller.id);
  pay(early.id, "ch_early");
  await applyRefund({
    chargeId: "ch_early",
    paymentIntentId: null,
    amountRefunded: early.amountCents,
    gross: early.amountCents,
    eventKey: "refund-early",
  });
  assert(commissionFor(early.id)?.status === "void", "a refund inside the window voids the commission");
  assert(debtsFor(reseller.id).length === 0, "a voided commission does not create debt");

  const disputed = sell("money-pan");
  attachReferrer(disputed.id, reseller.id);
  pay(disputed.id, "ch_dispute");
  await applyDisputeOpened({
    chargeId: "ch_dispute",
    paymentIntentId: null,
    amount: disputed.amountCents,
    disputeId: "dp_money",
  });
  assert(commissionFor(disputed.id)?.status === "void", "a dispute voids the commission");

  const returned = sell("money-pan");
  attachReferrer(returned.id, reseller.id);
  pay(returned.id, "ch_return");
  voidResellerCommission(returned.id, "return");
  assert(commissionFor(returned.id)?.status === "void", "a return voids the commission");

  const now = Date.now();
  const mature = sell("money-pan");
  attachReferrer(mature.id, reseller.id);
  pay(mature.id, "ch_mature");
  getDb().prepare("UPDATE orders SET delivered_at = ? WHERE id = ?").run(now - 15 * DAY, mature.id);
  const fresh = sell("money-pan");
  attachReferrer(fresh.id, reseller.id);
  pay(fresh.id, "ch_fresh");
  getDb().prepare("UPDATE orders SET delivered_at = ? WHERE id = ?").run(now - DAY, fresh.id);

  let stripeCalled = false;
  setStripeFetch(async () => {
    stripeCalled = true;
    throw new Error("the monthly batch must not call Stripe");
  });
  const first = runMonthlyBatch(now);
  setStripeFetch(null);
  assert(!stripeCalled, "the monthly batch does not call Stripe");
  assert(first.batches.length === 1, "one reseller gets one batch");
  assert(first.batches[0]?.orderIds.includes(mature.id), "the batch includes the matured sale");
  assert(!first.batches[0]?.orderIds.includes(fresh.id), "the batch skips a sale still inside the return window");
  assert(!first.batches[0]?.orderIds.includes(early.id), "the batch skips a refunded sale");
  assert(!first.batches[0]?.orderIds.includes(direct.id), "the batch skips a sale with no reseller");
  assert(first.batches[0]?.grossCents === 100 && first.batches[0]?.netCents === 100, "the batch pays the matured commission");
  assert(!JSON.stringify(first).includes("transfer"), "the batch record is not a Stripe transfer");
  assert(commissionFor(mature.id)?.status === "batched", "a batched commission is marked");
  assert(commissionFor(fresh.id)?.status === "pending", "an unmatured commission stays pending");

  await applyRefund({
    chargeId: "ch_mature",
    paymentIntentId: null,
    amountRefunded: mature.amountCents,
    gross: mature.amountCents,
    eventKey: "refund-mature",
  });
  assert(commissionFor(mature.id)?.status === "reversed", "a refund after batching reverses the commission");
  const debt = debtsFor(reseller.id);
  assert(debt.length === 1 && debt[0]?.open_cents === 100 && debt[0]?.status === "open", "the reversal becomes reseller debt");

  const nextSale = sell("money-pan");
  attachReferrer(nextSale.id, reseller.id);
  pay(nextSale.id, "ch_next");
  getDb().prepare("UPDATE orders SET delivered_at = ? WHERE id = ?").run(now - 15 * DAY, nextSale.id);
  const second = runMonthlyBatch(now);
  assert(second.batches.length === 1, "the next month still writes a batch");
  assert(second.batches[0]?.grossCents === 100 && second.batches[0]?.debtCents === 100, "debt is applied against the next commission");
  assert(second.batches[0]?.netCents === 0, "debt can use up the batch");
  assert(debtsFor(reseller.id)[0]?.status === "applied" && debtsFor(reseller.id)[0]?.open_cents === 0, "applied debt is closed");
  assert(!second.batches[0]?.orderIds.includes(fresh.id), "the second batch still skips the open return window");

  const publicPage = publishListing(admin.id, {
    ...page,
    productId: "public-pan",
    title: "Public pan",
    description: "A pan a shopper can see.",
    priceCents: 20000,
    supplierCostCents: 7351,
  });
  if ("error" in publicPage) throw new Error(publicPage.error);
  const publicWholesale = saveWholesaleCost(admin, "public-pan", 8642);
  assert(publicWholesale.status === 200, "the public sample still clears the margin guard");
  const hidden = getListing("public-pan");
  if (!hidden) throw new Error("public pan missing");
  assertPrivate("public listing", JSON.stringify(publicListing(hidden)));
  assertPrivate("reseller listing", JSON.stringify(resellerListing(hidden)));
  const publicOrder = sell("public-pan");
  assertPrivate("buyer order", JSON.stringify(buyerOrder({ ...getOrder(publicOrder.id)!, supplierAmountCents: 7351, supplierPaidCents: 8642 })));
  assertPrivate("reseller order", JSON.stringify(presentOrder(reseller, getOrder(publicOrder.id)!, hidden)));

  const { GET: listingsGet } = await import("../src/app/api/store/listings/route");
  const { GET: productGet } = await import("../src/app/api/store/listings/[productId]/route");
  const { GET: catalogGet } = await import("../src/app/api/store/catalog/route");
  const { POST: wholesalePost } = await import("../src/app/api/store/listings/[productId]/wholesale/route");
  const { SESSION_COOKIE } = await import("../src/lib/server/session-cookie");
  const listingsJson = JSON.stringify(await (await listingsGet(new Request("http://127.0.0.1/api/store/listings"))).json());
  const productJson = JSON.stringify(
    await (await productGet(new Request("http://127.0.0.1/api"), { params: Promise.resolve({ productId: "public-pan" }) })).json(),
  );
  const catalogJson = JSON.stringify(await (await catalogGet()).json());
  assertPrivate("listings API", listingsJson);
  assertPrivate("product API", productJson);
  assertPrivate("catalog API", catalogJson);
  const resellerWholesale = await wholesalePost(
    new Request("http://127.0.0.1/api/store/listings/public-pan/wholesale", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${resellerJoin.token}`, "content-type": "application/json" },
      body: JSON.stringify({ wholesaleCost: 8642 }),
    }),
    { params: Promise.resolve({ productId: "public-pan" }) },
  );
  const resellerWholesaleBody = await resellerWholesale.text();
  assert(resellerWholesale.status === 403, "a reseller cannot open the wholesale route");
  assertPrivate("reseller wholesale response", resellerWholesaleBody);

  const supplierJoin = signUp({ name: "Money Supplier", email: "money-supplier@example.com", password: "example-pass" });
  const supplier = "account" in supplierJoin ? supplierJoin.account : undefined;
  if (!supplier) throw new Error("supplier");
  getDb().prepare("UPDATE accounts SET role = 'supplier', email_verified = 1 WHERE id = ?").run(supplier.id);
  getDb()
    .prepare(
      `INSERT INTO supplier_catalog (
         id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
       ) VALUES ('money-catalog', ?, 'MONEY-CAT', 'Hidden cost pan', 7351, 8642, 'US', 1, ?)`,
    )
    .run(supplier.id, Date.now());
  const { GET: supplierCatalogGet } = await import("../src/app/api/supplier/catalog/route");
  const { POST: quotePost } = await import("../src/app/api/store/listings/quote/route");
  const resellerCatalog = await supplierCatalogGet(
    new Request("http://127.0.0.1/api/supplier/catalog", { headers: { cookie: `${SESSION_COOKIE}=${resellerJoin.token}` } }),
  );
  const resellerCatalogBody = await resellerCatalog.text();
  assert(resellerCatalog.status === 200, "a reseller can see approved catalog titles");
  assertPrivate("reseller catalog", resellerCatalogBody);
  const adminCatalog = await supplierCatalogGet(
    new Request("http://127.0.0.1/api/supplier/catalog", { headers: { cookie: `${SESSION_COOKIE}=${adminJoin.token}` } }),
  );
  const adminCatalogBody = await adminCatalog.text();
  assert(adminCatalogBody.includes("7351"), "an operator can see the supplier cost");
  const resellerQuote = await quotePost(
    new Request("http://127.0.0.1/api/store/listings/quote", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${resellerJoin.token}`, "content-type": "application/json" },
      body: JSON.stringify({ catalogItemId: "money-catalog", priceCents: 20000 }),
    }),
  );
  const resellerQuoteBody = await resellerQuote.text();
  assert(resellerQuote.status === 200, "a reseller can ask whether a price is allowed");
  assertPrivate("reseller quote", resellerQuoteBody);
  assert(!resellerQuoteBody.includes("platformFee") && !resellerQuoteBody.includes("resellerNet"), "a reseller quote has no platform fee");

  const html = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: { ...publicListing(hidden), image: "" },
      returnNote: "We'll email the return address when you start a return.",
      shareHref: buyerShareHref({ title: "Public pan", productUrl: "http://127.0.0.1/shop/public-pan" }),
    }),
  );
  assert(html.includes("Public pan"), "the product markup renders the title");
  assertPrivate("product HTML", html);

  console.log("money flow checks ok");
}

main();
