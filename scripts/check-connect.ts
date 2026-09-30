import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-connect-")), "market.sqlite");
delete process.env.ADMIN_EMAIL;
delete process.env.STORE_OPERATOR_EMAIL;
delete process.env.SUPPLIER_API_URL;
delete process.env.SUPPLIER_API_KEY;
delete process.env.PLATFORM_FEE_BPS;
delete process.env.STRIPE_ALLOW_LIVE;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function sign(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${v1}`;
}

function liveKey() {
  return `${["sk", "live"].join("_")}_example`;
}

function testKey() {
  return `${["sk", "test"].join("_")}_example`;
}

async function main() {
  const { explicitFeeBps, holdState, platformFeeBps, quoteSplit, splitProblem, US_TRANSFER_HOLD_MS } = await import(
    "../src/lib/server/fees"
  );
  assert(platformFeeBps() === 1000, "default fee is 10%");
  process.env.PLATFORM_FEE_BPS = "5000";
  assert(platformFeeBps() === 1200, "fee above 12% clamps");
  process.env.PLATFORM_FEE_BPS = "100";
  assert(platformFeeBps() === 800, "fee below 8% clamps");
  delete process.env.PLATFORM_FEE_BPS;
  const explicit = explicitFeeBps(900);
  assert(explicit === 900, "900 bps is inside the range");
  const rejected = explicitFeeBps(700);
  assert(typeof rejected === "object" && "error" in rejected, "700 bps is rejected");
  const split = quoteSplit({
    priceCents: 2695,
    qty: 2,
    supplierCostCents: 500,
    supplierShippingCents: 100,
    feeBps: 1000,
  });
  assert(split.grossCents === 5390, "gross");
  assert(split.platformFeeCents === 539, "platform fee");
  assert(split.supplierAmountCents === 1100, "supplier amount includes one shipping charge");
  assert(split.resellerAmountCents === 3751, "reseller amount");
  const bad = quoteSplit({
    priceCents: 1000,
    qty: 1,
    supplierCostCents: 950,
    supplierShippingCents: 0,
    feeBps: 1000,
  });
  assert(splitProblem(bad, "supplier") !== null, "negative reseller is rejected");
  const now = Date.now();
  assert(holdState(now, now) === "open", "a fresh payment is inside the hold");
  assert(holdState(now - (US_TRANSFER_HOLD_MS - 10 * 24 * 60 * 60 * 1000), now) === "nearing", "14 day warning");
  assert(holdState(now - US_TRANSFER_HOLD_MS - 1000, now) === "expired", "past the US hold window");

  const { isLiveKey, setStripeFetch, verifyStripeSignature, createCheckoutSession } = await import(
    "../src/lib/server/stripe"
  );
  assert(isLiveKey(liveKey()), "live key detector");
  assert(!isLiveKey(testKey()), "test key is allowed");
  const goodBody = "{}";
  const good = createHmac("sha256", "whsec_example").update(`${now / 1000 | 0}.${goodBody}`).digest("hex");
  const stamp = Math.floor(now / 1000);
  const goodSig = createHmac("sha256", "whsec_example").update(`${stamp}.${goodBody}`).digest("hex");
  const badSig = "ab".repeat(32);
  assert(verifyStripeSignature(goodBody, `t=${stamp},v1=${goodSig},v1=${badSig}`, "whsec_example"), "first v1 counts");
  assert(verifyStripeSignature(goodBody, `t=${stamp},v1=${badSig},v1=${goodSig}`, "whsec_example"), "later v1 counts");
  assert(!verifyStripeSignature(goodBody, `t=${stamp},v1=${badSig}`, "whsec_example"), "bad signature fails");
  assert(!verifyStripeSignature(goodBody, null, "whsec_example"), "missing header fails");
  assert(!verifyStripeSignature(goodBody, `t=${stamp - 600},v1=${goodSig}`, "whsec_example"), "old timestamp fails");
  void good;

  const calls: { url: string; method: string; body: string; idempotency: string | null }[] = [];
  let ships = 0;
  let active: { id: string; amountCents: number; accountId: string } | null = null;
  let risk: "normal" | "elevated" = "normal";
  let pay: "paid" | "unpaid" = "paid";

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
  }

  async function routed(url: string | URL | Request, init?: RequestInit) {
    const href = String(url);
    const method = init?.method ?? "GET";
    const headers = new Headers(init?.headers);
    const rawBody = init?.body;
    const body =
      typeof rawBody === "string" ? rawBody : rawBody instanceof URLSearchParams ? rawBody.toString() : "";
    if (href.startsWith("https://supplier.test")) {
      ships += 1;
      return json({ reference: "SUP-1" });
    }
    calls.push({ url: href, method, body, idempotency: headers.get("Idempotency-Key") });
    if (method === "POST" && (!headers.get("Idempotency-Key") || !headers.get("Stripe-Version"))) {
      return json({ error: { message: "missing stripe headers" } }, 400);
    }
    if (href.includes("/v1/checkout/sessions/")) {
      const sessionId = decodeURIComponent(href.split("/v1/checkout/sessions/")[1]?.split("?")[0] ?? "cs");
      return json({
        id: sessionId,
        url: null,
        status: "complete",
        payment_status: pay,
        customer: "cus_test",
        subscription: pay === "paid" ? "sub_test" : null,
        amount_total: active?.amountCents ?? 1000,
        metadata: active
          ? { kind: "order", order_id: active.id, account_id: active.accountId }
          : { kind: "membership", account_id: "missing" },
        payment_intent: {
          id: `pi_${sessionId}`,
          latest_charge: { id: `ch_${sessionId}`, outcome: { risk_level: risk, type: "authorized" } },
        },
      });
    }
    if (href.includes("/reversals")) return json({ id: "trr_test" });
    if (href.includes("/v1/transfers")) return json({ id: `tr_${calls.length}` });
    if (href.includes("/v2/core/account_links")) return json({ url: "https://connect.stripe.com/setup/s/test" });
    if (href.includes("/v2/core/accounts")) {
      return json({
        id: "acct_test",
        dashboard: "express",
        configuration: {
          recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: "active" } } } },
        },
        requirements: { entries: [] },
      });
    }
    return json({ id: "obj_test" });
  }

  setStripeFetch(routed);
  const originalFetch = global.fetch;
  global.fetch = routed as typeof fetch;
  process.env.STRIPE_SECRET_KEY = liveKey();
  let refused = false;
  try {
    await createCheckoutSession({
      kind: "membership",
      accountId: "acct",
      name: "XVAIsle membership",
      amountCents: 1000,
      successPath: "/membership",
      cancelPath: "/membership",
    });
  } catch (error) {
    refused = error instanceof Error && error.message.includes("Live Stripe keys are refused");
  }
  assert(refused, "live keys are refused");
  assert(!calls.some((call) => call.url.includes("checkout")), "a refused live key never calls Stripe");
  process.env.STRIPE_SECRET_KEY = testKey();

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { getAccount, setOwnRole, signUp } = await import("../src/lib/server/accounts");
  const { publishForAccount } = await import("../src/lib/server/publish");
  const { createPendingOrder, publishListing } = await import("../src/lib/server/store");
  const { acceptStripeEvent } = await import("../src/lib/server/stripe-events");
  const { saveReturnsFor } = await import("../src/lib/server/settings");
  const { addInquiry, inquiriesFor } = await import("../src/lib/server/inquiries");
  const { deliverFor, approveFor } = await import("../src/lib/server/order-actions");
  const { acceptSupplierDelivery } = await import("../src/lib/server/supplier-callback");
  const { beginOnboarding } = await import("../src/lib/server/connect");
  const { markDelivered } = await import("../src/lib/server/ledger");

  const first = signUp({ name: "First Person", email: "first@xvaisle.test", password: "market-test" });
  if ("error" in first) throw new Error(first.error);
  assert(first.account.role === "buyer", "the first account is not the operator");
  process.env.ADMIN_EMAIL = "admin@xvaisle.test";
  const adminJoin = signUp({ name: "Operator", email: "admin@xvaisle.test", password: "market-test" });
  if ("error" in adminJoin) throw new Error(adminJoin.error);
  assert(adminJoin.account.role === "admin", "ADMIN_EMAIL is the operator");
  const resellerJoin = signUp({ name: "Reseller", email: "reseller@xvaisle.test", password: "market-test" });
  const supplierJoin = signUp({ name: "Supplier", email: "supplier@xvaisle.test", password: "market-test" });
  if ("error" in resellerJoin || "error" in supplierJoin) throw new Error("accounts");
  assert(getAccount(first.account.id)?.role === "buyer", "a later admin email does not promote earlier accounts");
  const resellerRole = setOwnRole(resellerJoin.account.id, "reseller");
  const supplierRole = setOwnRole(supplierJoin.account.id, "supplier");
  if ("error" in resellerRole || "error" in supplierRole) throw new Error("roles");

  const deniedReturns = saveReturnsFor(resellerRole.account, "100 Example Street, Sample City, ST 00000");
  assert("error" in deniedReturns && deniedReturns.status === 403, "a reseller cannot change the return address");
  const savedReturns = saveReturnsFor(adminJoin.account, "100 Example Street, Sample City, ST 00000");
  assert(!("error" in savedReturns) && savedReturns.status === 200, "the operator can save the return address");
  const note = addInquiry({ name: "Example Buyer", email: "buyer@example.com", message: "Where is the pan?" });
  if ("error" in note) throw new Error(note.error);
  const hidden = inquiriesFor(resellerRole.account);
  assert("error" in hidden && hidden.status === 403, "buyer notes are not for listing owners");
  const visible = inquiriesFor(adminJoin.account);
  assert(!("error" in visible) && visible.inquiries.length === 1, "the operator can read buyer notes");

  const page = {
    productId: "pan",
    sku: "PAN-1",
    title: "Quarter sheet pan",
    description: "One pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: supplierJoin.account.id,
    supplierCostCents: 500,
    supplierShippingCents: 0,
  };
  const buyerPublish = publishForAccount(resellerRole.account, page);
  assert(buyerPublish.status === 403, "membership is required to publish");
  getDb()
    .prepare("UPDATE accounts SET member_since = ?, membership_status = 'active' WHERE id = ?")
    .run(Date.now(), resellerJoin.account.id);
  const member = getAccount(resellerJoin.account.id);
  if (!member) throw new Error("member missing");
  const noConnect = publishForAccount(member, page);
  assert(noConnect.status === 403, "payout setup is required to publish");
  const db = getDb();
  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, ?, 0, 1, 1, '', 'active', ?)`,
  ).run(resellerJoin.account.id, "acct_reseller", Date.now());
  const supplierDown = publishForAccount(getAccount(resellerJoin.account.id)!, page);
  assert(supplierDown.status === 400, "the supplier must be able to receive transfers");
  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, ?, 0, 1, 1, '', 'active', ?)`,
  ).run(supplierJoin.account.id, "acct_supplier", Date.now());
  const tooHigh = publishForAccount(getAccount(resellerJoin.account.id)!, { ...page, supplierCostCents: 5000 });
  assert(tooHigh.status === 400, "a listing that pays the reseller less than zero is rejected");
  const listed = publishForAccount(getAccount(resellerJoin.account.id)!, page);
  assert(listed.status === 200, "a member with payouts can publish");

  const order = createPendingOrder({
    productId: "pan",
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
  if ("error" in order) throw new Error(order.error);
  publishListing(resellerJoin.account.id, { ...page, productId: "bad-pan", priceCents: 1000, supplierCostCents: 950 });
  const rejectedOrder = createPendingOrder({
    productId: "bad-pan",
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
  assert("error" in rejectedOrder, "checkout rejects a negative reseller share");

  process.env.SUPPLIER_API_URL = "https://supplier.test/orders";
  process.env.SUPPLIER_API_KEY = "test-key";
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_billing";
  active = { id: order.order.id, amountCents: order.order.amountCents, accountId: order.order.accountId };
  pay = "unpaid";
  const unpaidRaw = JSON.stringify({
    id: "evt_unpaid",
    type: "checkout.session.completed",
    data: { object: { id: "cs_unpaid" } },
  });
  const unpaid = await acceptStripeEvent(unpaidRaw, sign(unpaidRaw, "whsec_billing"), "whsec_billing");
  assert(unpaid.status === 200, "unpaid complete sessions are acknowledged");
  const stillPending = db.prepare("SELECT status FROM orders WHERE id = ?").get(order.order.id) as { status: string };
  assert(stillPending.status === "pending", "complete is not paid");
  assert(ships === 0, "an unpaid session does not ship");

  pay = "paid";
  risk = "normal";
  const paidRaw = JSON.stringify({
    id: "evt_paid",
    type: "checkout.session.completed",
    data: { object: { id: "cs_paid" } },
  });
  const paidHeader = sign(paidRaw, "whsec_billing");
  const paidEvent = await acceptStripeEvent(paidRaw, paidHeader, "whsec_billing");
  assert(paidEvent.status === 200, "paid event settles");
  const replay = await acceptStripeEvent(paidRaw, paidHeader, "whsec_billing");
  assert(replay.status === 200 && "duplicate" in replay.body && replay.body.duplicate === true, "replay is a duplicate");
  assert(ships === 1, "fulfillment runs once");
  const ledger = db.prepare("SELECT status, party, amount_cents FROM ledger WHERE order_id = ?").all(order.order.id) as {
    status: string;
    party: string;
    amount_cents: number;
  }[];
  assert(ledger.length === 2 && ledger.every((row) => row.status === "pending"), "ledger waits for delivery");
  assert(!calls.some((call) => call.url.includes("/v1/transfers")), "no transfer before delivery");
  const forged = await deliverFor(resellerRole.account, order.order.id);
  assert("error" in forged && forged.status === 403, "a reseller cannot mark delivery");
  const delivered = await deliverFor(adminJoin.account, order.order.id);
  assert(!("error" in delivered), "the operator can mark delivery");
  const transfers = calls.filter((call) => call.method === "POST" && call.url.includes("/v1/transfers") && !call.url.includes("reversals"));
  assert(transfers.length === 2, "delivery creates two transfers");
  assert(
    transfers.every(
      (call) =>
        call.idempotency &&
        call.body.includes("source_transaction=") &&
        call.body.includes(`transfer_group=order_${order.order.id}`) &&
        !call.body.includes("application_fee_amount"),
    ),
    "transfers use the charge, the order group, and no application fee",
  );
  const again = await markDelivered(order.order.id);
  if ("error" in again) throw new Error(again.error);
  const transfersAfter = calls.filter(
    (call) => call.method === "POST" && call.url.includes("/v1/transfers") && !call.url.includes("reversals"),
  );
  assert(transfersAfter.length === 2, "a second delivery does not transfer again");

  const refundRaw = JSON.stringify({
    id: "evt_refund",
    type: "charge.refunded",
    data: { object: { id: "ch_cs_paid", payment_intent: "pi_cs_paid", amount: order.order.amountCents, amount_refunded: order.order.amountCents } },
  });
  const refunded = await acceptStripeEvent(refundRaw, sign(refundRaw, "whsec_billing"), "whsec_billing");
  assert(refunded.status === 200, "refund event");
  const afterRefund = db.prepare("SELECT status FROM ledger WHERE order_id = ?").all(order.order.id) as { status: string }[];
  assert(afterRefund.every((row) => row.status === "reversed"), "refunds reverse transfers");
  assert(calls.some((call) => call.url.includes("/reversals")), "refund calls Stripe reversals");

  const badSignature = await acceptStripeEvent(paidRaw, sign(paidRaw, "other"), "whsec_billing");
  assert(badSignature.status === 400, "a bad webhook signature is rejected");

  process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_connect";
  const updatedRaw = JSON.stringify({
    id: "evt_acct",
    type: "account.updated",
    account: "acct_supplier",
    data: { object: { id: "acct_supplier" } },
  });
  db.prepare("UPDATE connected_accounts SET payouts_enabled = 0, transfers_status = 'pending' WHERE stripe_account_id = ?").run(
    "acct_supplier",
  );
  const accountFetches = () => calls.filter((call) => call.url.includes("/v2/core/accounts/")).length;
  const beforeFetch = accountFetches();
  const updated = await acceptStripeEvent(updatedRaw, sign(updatedRaw, "whsec_connect"), "whsec_connect");
  assert(updated.status === 200, "account.updated");
  const supplierRow = db.prepare("SELECT transfers_status, payouts_enabled FROM connected_accounts WHERE stripe_account_id = ?").get(
    "acct_supplier",
  ) as { transfers_status: string; payouts_enabled: number };
  assert(supplierRow.transfers_status === "active" && supplierRow.payouts_enabled === 1, "capability status is stored");
  await acceptStripeEvent(updatedRaw, sign(updatedRaw, "whsec_connect"), "whsec_connect");
  assert(accountFetches() === beforeFetch + 1, "account.updated replay does not fetch again");
  const goneRaw = JSON.stringify({
    id: "evt_gone",
    type: "account.application.deauthorized",
    account: "acct_supplier",
    data: { object: { id: "ca_test" } },
  });
  await acceptStripeEvent(goneRaw, sign(goneRaw, "whsec_connect"), "whsec_connect");
  const disabled = db.prepare("SELECT transfers_status, payouts_enabled FROM connected_accounts WHERE stripe_account_id = ?").get(
    "acct_supplier",
  ) as { transfers_status: string; payouts_enabled: number };
  assert(disabled.transfers_status === "disabled" && disabled.payouts_enabled === 0, "deauthorization disables payouts");

  db.prepare(
    "UPDATE connected_accounts SET payouts_enabled = 1, transfers_status = 'active' WHERE account_id = ?",
  ).run(supplierJoin.account.id);
  const linker = signUp({ name: "Linker", email: "linker@xvaisle.test", password: "market-test" });
  if ("error" in linker) throw new Error(linker.error);
  const linkerRole = setOwnRole(linker.account.id, "reseller");
  if ("error" in linkerRole) throw new Error(linkerRole.error);
  const onboard = await beginOnboarding(linkerRole.account);
  assert(onboard.status === 200 && "url" in onboard, "onboarding returns a Stripe link");
  const created = calls.find((call) => call.method === "POST" && call.url.endsWith("/v2/core/accounts"));
  assert(created?.idempotency?.includes(linker.account.id), "account creation sends an idempotency key");
  assert(created && created.body.includes('"dashboard":"express"'), "dashboard is express");
  assert(created && created.body.includes('"fees_collector":"application"'), "the platform pays Stripe fees");
  assert(created && !created.body.includes('"type":"express"'), "account creation does not use a legacy type");

  const riskPage = publishListing(resellerJoin.account.id, {
    ...page,
    productId: "risk-pan",
    sku: "PAN-R",
    supplierAccountId: supplierJoin.account.id,
  });
  if ("error" in riskPage) throw new Error(riskPage.error);
  const risky = createPendingOrder({
    productId: "risk-pan",
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
  if ("error" in risky) throw new Error(risky.error);
  active = { id: risky.order.id, amountCents: risky.order.amountCents, accountId: risky.order.accountId };
  risk = "elevated";
  const riskRaw = JSON.stringify({
    id: "evt_risk",
    type: "checkout.session.completed",
    data: { object: { id: "cs_risk" } },
  });
  await acceptStripeEvent(riskRaw, sign(riskRaw, "whsec_billing"), "whsec_billing");
  const beforeRiskTransfers = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  await markDelivered(risky.order.id);
  const held = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  assert(held === beforeRiskTransfers, "elevated risk does not transfer");
  const approved = await approveFor(adminJoin.account, risky.order.id);
  assert(!("error" in approved), "admin can approve");
  const released = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  assert(released === held + 2, "approval releases the two shares");

  const disputePage = publishListing(resellerJoin.account.id, {
    ...page,
    productId: "dispute-pan",
    sku: "PAN-D",
    supplierAccountId: supplierJoin.account.id,
  });
  if ("error" in disputePage) throw new Error(disputePage.error);
  const disputedOrder = createPendingOrder({
    productId: "dispute-pan",
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
  if ("error" in disputedOrder) throw new Error(disputedOrder.error);
  active = {
    id: disputedOrder.order.id,
    amountCents: disputedOrder.order.amountCents,
    accountId: disputedOrder.order.accountId,
  };
  risk = "normal";
  const disputePay = JSON.stringify({
    id: "evt_dispute_pay",
    type: "checkout.session.completed",
    data: { object: { id: "cs_dispute" } },
  });
  await acceptStripeEvent(disputePay, sign(disputePay, "whsec_billing"), "whsec_billing");
  await markDelivered(disputedOrder.order.id);
  const disputeRaw = JSON.stringify({
    id: "evt_dispute",
    type: "charge.dispute.created",
    data: {
      object: {
        id: "dp_test",
        charge: "ch_cs_dispute",
        payment_intent: "pi_cs_dispute",
        amount: disputedOrder.order.amountCents,
        status: "needs_response",
      },
    },
  });
  await acceptStripeEvent(disputeRaw, sign(disputeRaw, "whsec_billing"), "whsec_billing");
  const frozen = db.prepare("SELECT dispute_open FROM orders WHERE id = ?").get(disputedOrder.order.id) as {
    dispute_open: number;
  };
  assert(frozen.dispute_open === 1, "a dispute freezes the order");
  const reversed = db.prepare("SELECT status FROM ledger WHERE order_id = ?").all(disputedOrder.order.id) as {
    status: string;
  }[];
  assert(reversed.every((row) => row.status === "reversed"), "an open dispute reverses transfers");
  const wonRaw = JSON.stringify({
    id: "evt_won",
    type: "charge.dispute.closed",
    data: { object: { id: "dp_test", charge: "ch_cs_dispute", payment_intent: "pi_cs_dispute", status: "won" } },
  });
  const beforeRestore = calls.filter((call) => call.body.includes("restore-") || call.idempotency?.includes("restore-")).length;
  await acceptStripeEvent(wonRaw, sign(wonRaw, "whsec_billing"), "whsec_billing");
  const restores = calls.filter((call) => call.idempotency?.includes("restore-")).length;
  assert(restores === beforeRestore + 2, "a won dispute restores the two shares");

  process.env.SUPPLIER_CALLBACK_SECRET = "supplier-secret";
  const callback = JSON.stringify({ orderId: disputedOrder.order.id, supplierAccountId: supplierJoin.account.id });
  const wrong = await acceptSupplierDelivery(callback, sign(callback, "nope"));
  assert(wrong.status === 400, "supplier callback rejects a bad signature");
  const right = await acceptSupplierDelivery(callback, sign(callback, "supplier-secret"));
  assert(right.status === 200, "a signed supplier can mark delivery");

  assert(!existsSync("src/app/api/account/payout/route.ts"), "raw payout collection is gone");
  const accounts = await import("../src/lib/server/accounts");
  assert(!("savePayout" in accounts), "the server does not accept payout numbers");

  global.fetch = originalFetch;
  setStripeFetch(null);
  closeDb();
  console.log("connect checks ok");
}

main();
