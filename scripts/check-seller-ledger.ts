import { createElement } from "react";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-ledger-")), "market.sqlite");
process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
delete process.env.SELLER_LEDGER_ENABLED;
delete process.env.PLATFORM_FEE_BPS;
delete process.env.STRIPE_FEE_BPS;
delete process.env.STRIPE_FEE_FIXED_CENTS;
delete process.env.STRIPE_ALLOW_LIVE;
process.env.STRIPE_SECRET_KEY = "sk_test_ledger";

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

async function main() {
  const fees = await import("../src/lib/server/fees");
  const { getAccount, signUp } = await import("../src/lib/server/accounts");
  const { getDb } = await import("../src/lib/server/db");
  const { releaseTransfers } = await import("../src/lib/server/ledger");
  const { publishForAccount, quoteForAccount } = await import("../src/lib/server/publish");
  const { POST } = await import("../src/app/api/store/listings/quote/route");
  const { setStripeFetch } = await import("../src/lib/server/stripe");
  const { createPendingOrder, getOrder, publishListing } = await import("../src/lib/server/store");
  const { ResellerArticle } = await import("../src/app/shop/reseller/page");

  assert(!fees.sellerLedgerEnabled(), "the seller ledger is off by default");
  for (const value of ["", "0", "false", "off", "yes"]) {
    process.env.SELLER_LEDGER_ENABLED = value;
    assert(!fees.sellerLedgerEnabled(), `${value || "blank"} does not enable the seller ledger`);
  }
  delete process.env.SELLER_LEDGER_ENABLED;

  const off = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1200,
  });
  assert(off.feeBps === 0 && off.platformFeeCents === 0, "a requested 12% fee is not charged while the flag is off");
  assert(
    fees.reserveHoldCents({ payoutCents: 1500, heldCents: 0, bps: 1000, capCents: 10000 }) === 0,
    "no reserve is calculated while the flag is off",
  );

  const adminJoin = signUp({ name: "Ledger Operator", email: "ledger-operator@example.com", password: "example-pass" });
  const resellerJoin = signUp({ name: "Ledger Reseller", email: "ledger-reseller@example.com", password: "example-pass" });
  const supplierJoin = signUp({ name: "Ledger Supplier", email: "ledger-supplier@example.com", password: "example-pass" });
  const admin = "account" in adminJoin ? adminJoin.account : undefined;
  const reseller = "account" in resellerJoin ? resellerJoin.account : undefined;
  const supplier = "account" in supplierJoin ? supplierJoin.account : undefined;
  const resellerToken = "token" in resellerJoin ? resellerJoin.token : undefined;
  const adminToken = "token" in adminJoin ? adminJoin.token : undefined;
  if (!admin || !reseller || !supplier || !resellerToken || !adminToken) throw new Error("account");
  const db = getDb();
  db.prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(admin.id);
  db.prepare("UPDATE accounts SET role = 'reseller', email_verified = 1 WHERE id = ?").run(reseller.id);
  db.prepare("UPDATE accounts SET role = 'supplier', email_verified = 1 WHERE id = ?").run(supplier.id);
  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, 'acct_reseller', 1, 1, 1, '', 'active', ?)`,
  ).run(reseller.id, Date.now());
  db.prepare(
    `INSERT INTO supplier_catalog (
       id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
     ) VALUES ('cat-ledger', ?, 'LEDGER', 'Ledger pan', 400, 0, 'Portland, Oregon', 1, ?)`,
  ).run(supplier.id, Date.now());

  const listed = publishListing(admin.id, {
    productId: "ledger-pan",
    sku: "LEDGER",
    title: "Ledger pan",
    description: "One pan.",
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Example Goods",
    supplierOrigin: "US",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: supplier.id,
    supplierCostCents: 400,
    priceCents: 2000,
    catalogItemId: "cat-ledger",
  });
  if ("error" in listed || !listed.listing) throw new Error("error" in listed ? listed.error : "listing");
  assert(listed.listing.feeBps == null, "publishing does not stamp an 8–12% fee while the flag is off");

  const pending = createPendingOrder({ productId: "ledger-pan", qty: 1, ship });
  if ("error" in pending) throw new Error(pending.error);
  assert(pending.order.platformFeeCents === 0 && pending.order.feeBps === 0, "checkout does not charge the platform fee");

  const now = Date.now();
  db.prepare(
    `UPDATE orders
     SET status = 'paid', paid_at = ?, delivered_at = ?, buyer_confirmed_at = ?, charge_id = 'ch_ledger', risk_level = 'normal'
     WHERE id = ?`,
  ).run(now, now, now, pending.order.id);
  db.prepare(
    `INSERT INTO ledger (id, order_id, party, account_id, amount_cents, status, transfer_id, reversed_cents, reversal_reason)
     VALUES ('led-reseller', ?, 'reseller', ?, ?, 'pending', NULL, 0, NULL)`,
  ).run(pending.order.id, reseller.id, pending.order.resellerAmountCents);
  const transferred: number[] = [];
  setStripeFetch(async (url, init) => {
    const body = String(init?.body ?? "");
    const amount = Number(new URLSearchParams(body).get("amount"));
    if (String(url).includes("/v1/transfers") && amount > 0) transferred.push(amount);
    return new Response(JSON.stringify({ id: "tr_ledger" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const released = await releaseTransfers(pending.order.id);
  assert(released.transferred === 1 && released.blocked == null, "the reseller payout goes out");
  assert(transferred[0] === pending.order.resellerAmountCents, "Stripe is asked for the full reseller share");
  const reserve = db.prepare("SELECT id FROM ledger WHERE order_id = ? AND party = 'reserve'").get(pending.order.id);
  assert(reserve == null, "release does not hold a reserve");
  assert(getOrder(pending.order.id)?.platformFeeCents === 0, "the paid order still has no platform fee");

  const quote = quoteForAccount({ catalogItemId: "cat-ledger", priceCents: 2000 });
  if (quote.status !== 200) throw new Error(quote.error);
  assert(quote.quote.platformFeeCents === 0, "the server quote charges no platform fee");
  const resellerQuote = await POST(
    new Request("http://127.0.0.1/api/store/listings/quote", {
      method: "POST",
      headers: { cookie: `xvaisle_session=${resellerToken}`, "content-type": "application/json" },
      body: JSON.stringify({ catalogItemId: "cat-ledger", priceCents: 2000, feeBps: 1200, platformFeeCents: 240 }),
    }),
  );
  const resellerBody = await resellerQuote.text();
  assert(!resellerBody.includes("platformFee"), "a reseller quote has no platform fee field");
  assert(!resellerBody.includes("8–12") && !resellerBody.includes("120"), "a reseller quote has no fee or reserve copy");
  const adminQuote = await POST(
    new Request("http://127.0.0.1/api/store/listings/quote", {
      method: "POST",
      headers: { cookie: `xvaisle_session=${adminToken}`, "content-type": "application/json" },
      body: JSON.stringify({ catalogItemId: "cat-ledger", priceCents: 2000 }),
    }),
  );
  const adminBody = await adminQuote.text();
  assert(!adminBody.includes("platformFee"), "an operator quote omits the platform fee while the flag is off");
  assert(!adminBody.includes("8–12") && !adminBody.includes("120"), "an operator quote has no fee or reserve copy");

  const page = renderToStaticMarkup(createElement(ResellerArticle));
  assert(!page.includes("8–12") && !page.includes("120 days"), "the reseller page does not describe the seller ledger");

  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, 'acct_ledger_operator', 1, 1, 1, '', 'active', ?)`,
  ).run(admin.id, Date.now());
  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, 'acct_ledger_supplier', 1, 1, 1, '', 'active', ?)`,
  ).run(supplier.id, Date.now());
  const operatorAccount = getAccount(admin.id);
  const resellerAccount = getAccount(reseller.id);
  if (!operatorAccount || !resellerAccount) throw new Error("ledger accounts missing");
  const ownPage = {
    sku: "LEDGER",
    title: "Own ledger pan",
    description: "One pan.",
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Example Goods",
    supplierOrigin: "US",
    shipDaysMin: 2,
    shipDaysMax: 4,
    catalogItemId: "cat-ledger",
    priceCents: 2000,
    feeBps: 1200,
  };
  process.env.STORE_OPERATOR_EMAIL = admin.email;
  const ownOff = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1200,
    sellerAccountId: admin.id,
  });
  assert(ownOff.feeBps === 0 && ownOff.platformFeeCents === 0, "an own-store split is free while the flag is off");
  const resellerOff = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1200,
    sellerAccountId: reseller.id,
  });
  assert(resellerOff.feeBps === 0 && resellerOff.platformFeeCents === 0, "a reseller split stays free while the flag is off");
  const ownOffPage = publishForAccount(operatorAccount, { ...ownPage, productId: "own-ledger-off" });
  assert(ownOffPage.status === 200 && ownOffPage.listing?.feeBps === 0, "an own-store publish stores zero while the flag is off");
  const ownOffOrder = createPendingOrder({ productId: "own-ledger-off", qty: 1, ship });
  if ("error" in ownOffOrder) throw new Error(ownOffOrder.error);
  assert(ownOffOrder.order.feeBps === 0 && ownOffOrder.order.platformFeeCents === 0, "an own-store checkout stores zero while the flag is off");
  console.log("pass an own-store split is free while the flag is off");
  console.log("pass a reseller split stays free while the flag is off");
  console.log("pass an own-store publish stores zero while the flag is off");
  console.log("pass an own-store checkout stores zero while the flag is off");

  process.env.SELLER_LEDGER_ENABLED = "1";
  const on = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1000,
  });
  assert(on.platformFeeCents === 200 && on.feeBps === 1000 && on.resellerAmountCents === 1312, "the same split charges 10% after the flag is turned on");
  const ownOn = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1000,
    sellerAccountId: admin.id,
  });
  assert(ownOn.feeBps === 0 && ownOn.platformFeeCents === 0 && ownOn.resellerAmountCents === 1512, "an own-store split stays free after the flag is turned on");
  const ownOnPage = publishForAccount(operatorAccount, { ...ownPage, productId: "own-ledger-on" });
  assert(ownOnPage.status === 200 && ownOnPage.listing?.feeBps === 0, "an own-store publish stores zero with the flag on");
  const ownOnOrder = createPendingOrder({ productId: "own-ledger-on", qty: 1, ship });
  if ("error" in ownOnOrder) throw new Error(ownOnOrder.error);
  assert(ownOnOrder.order.feeBps === 0 && ownOnOrder.order.platformFeeCents === 0, "an own-store checkout stores zero with the flag on");
  const resellerOnPage = publishForAccount(resellerAccount, { ...ownPage, productId: "reseller-ledger-on", title: "Reseller ledger pan" });
  assert(resellerOnPage.status === 200 && resellerOnPage.listing?.feeBps === 1000, "a reseller publish stores 10% with the flag on");
  delete process.env.STORE_OPERATOR_EMAIL;
  const missed = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1000,
    sellerAccountId: admin.id,
  });
  assert(missed.feeBps === 1000 && missed.platformFeeCents === 200, "an unset operator email charges the reseller fee");
  process.env.STORE_OPERATOR_EMAIL = admin.email;
  const notOperator = fees.quoteSplit({
    priceCents: 2000,
    qty: 1,
    supplierCostCents: 400,
    supplierShippingCents: 0,
    feeBps: 1000,
    sellerAccountId: reseller.id,
  });
  assert(notOperator.feeBps === 1000 && notOperator.platformFeeCents === 200, "an account that is not the operator pays the reseller fee");
  delete process.env.STORE_OPERATOR_EMAIL;
  console.log("pass an own-store split stays free after the flag is turned on");
  console.log("pass an own-store publish stores zero with the flag on");
  console.log("pass an own-store checkout stores zero with the flag on");
  console.log("pass a reseller publish stores 10% with the flag on");
  console.log("pass an unset operator email charges the reseller fee");
  console.log("pass an account that is not the operator pays the reseller fee");
  assert(
    fees.reserveHoldCents({ payoutCents: 1500, heldCents: 0, bps: 1000, capCents: 10000 }) === 150,
    "the reserve calculation returns after the flag is turned on",
  );
  delete process.env.SELLER_LEDGER_ENABLED;
  assert(
    fees.quoteSplit({
      priceCents: 2000,
      qty: 1,
      supplierCostCents: 400,
      supplierShippingCents: 0,
      feeBps: 1000,
    }).platformFeeCents === 0,
    "turning the flag off stops the fee again",
  );

  console.log("seller ledger flag checks ok");
}

void main();
