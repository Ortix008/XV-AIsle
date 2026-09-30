import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-connect-")), "market.sqlite");
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_EMAILS;
delete process.env.STORE_OPERATOR_EMAIL;
delete process.env.SUPPLIER_API_URL;
delete process.env.SUPPLIER_API_KEY;
delete process.env.PLATFORM_FEE_BPS;
delete process.env.STRIPE_ALLOW_LIVE;
delete process.env.SMTP_HOST;
delete process.env.SUPPLIER_CALLBACK_SECRET;

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
  const { isStripeCheckoutUrl } = await import("../src/lib/checkout-url");
  assert(isStripeCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_a"), "stripe checkout host is allowed");
  assert(!isStripeCheckoutUrl("https://evil.example/checkout.stripe.com"), "a lookalike host is refused");
  assert(!isStripeCheckoutUrl("http://checkout.stripe.com/c/pay/cs_test_a"), "checkout must be https");
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
  let subscriptionStatus = "active";
  let subscriptionAccountId = "";

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
    if (href.includes("/v1/subscriptions/")) {
      const subscriptionId = decodeURIComponent(href.split("/v1/subscriptions/")[1]?.split("?")[0] ?? "sub");
      return json({
        id: subscriptionId,
        status: subscriptionStatus,
        customer: "cus_test",
        metadata: { account_id: subscriptionAccountId },
      });
    }
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
  await createCheckoutSession({
    kind: "membership",
    accountId: "acct-1",
    name: "XVAIsle membership",
    amountCents: 1000,
    successPath: "/membership",
    cancelPath: "/membership",
    attemptId: "attempt-a",
  });
  await createCheckoutSession({
    kind: "membership",
    accountId: "acct-1",
    name: "XVAIsle membership",
    amountCents: 1000,
    successPath: "/membership",
    cancelPath: "/membership",
    attemptId: "attempt-b",
  });
  const membershipCalls = calls.filter((call) => call.url.endsWith("/v1/checkout/sessions"));
  assert(membershipCalls.length >= 2, "membership checkout was sent");
  assert(
    decodeURIComponent(membershipCalls[0]?.body ?? "").includes("subscription_data[trial_period_days]=30"),
    "membership includes a 30 day trial",
  );
  assert(membershipCalls[0]?.idempotency?.includes("attempt-a"), "membership idempotency uses the attempt");
  assert(membershipCalls[1]?.idempotency?.includes("attempt-b"), "a second attempt gets its own key");
  assert(membershipCalls[0]?.idempotency !== membershipCalls[1]?.idempotency, "membership keys are not the calendar day");

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { confirmTotp, getAccount, seedAdmin, sendAccountVerification, setOwnRole, signIn, signUp, startTotp, verifyEmailToken } = await import(
    "../src/lib/server/accounts"
  );
  const { hasActiveMembership } = await import("../src/lib/account");
  const { publishForAccount } = await import("../src/lib/server/publish");
  const { createCatalogItem, reviewCatalogItem } = await import("../src/lib/server/catalog");
  const { totpCode } = await import("../src/lib/server/totp");
  const { createPendingOrder, publishListing } = await import("../src/lib/server/store");
  const { acceptStripeEvent } = await import("../src/lib/server/stripe-events");
  const { saveReturnsFor } = await import("../src/lib/server/settings");
  const { addInquiry, inquiriesFor } = await import("../src/lib/server/inquiries");
  const { deliverFor, approveFor } = await import("../src/lib/server/order-actions");
  const { acceptSupplierDelivery } = await import("../src/lib/server/supplier-callback");
  const { beginOnboarding } = await import("../src/lib/server/connect");
  const { confirmReceipt, disputeReceipt, markDelivered, releaseMatured } = await import("../src/lib/server/ledger");
  const { flagRefundDeadlines, markShipped, sweepStuckFulfillment } = await import("../src/lib/server/store");
  const { rotateSupplierSecret } = await import("../src/lib/server/supplier-secret");

  const first = signUp({ name: "First Person", email: "first@xvaisle.test", password: "market-test" });
  if ("error" in first) throw new Error(first.error);
  assert(first.account.role === "buyer", "the first account is not the operator");
  process.env.ADMIN_EMAIL = "admin@xvaisle.test";
  process.env.ADMIN_EMAILS = "admin@xvaisle.test,second-owner@xvaisle.test";
  const adminJoin = signUp({ name: "Operator", email: "admin@xvaisle.test", password: "market-test" });
  if ("error" in adminJoin) throw new Error(adminJoin.error);
  assert(adminJoin.account.role === "buyer", "signup with ADMIN_EMAIL is not an admin");
  assert(adminJoin.account.role === "buyer", "ADMIN_EMAILS does not grant admin on signup");
  delete process.env.ADMIN_EMAILS;
  assert(!adminJoin.account.emailVerified, "signup is not verified");
  const issued = await sendAccountVerification(adminJoin.account.id);
  if (!("token" in issued) || !issued.token) throw new Error("verification token");
  const verifiedSignup = verifyEmailToken(issued.token);
  assert(!("error" in verifiedSignup) && verifiedSignup.account?.emailVerified, "the token verifies the email");
  const seeded = seedAdmin({ name: "Operator", email: "admin@xvaisle.test", password: "market-test" });
  if ("error" in seeded) throw new Error(seeded.error);
  assert(seeded.account.role === "admin" && seeded.account.emailVerified, "the seed script role is a verified admin");
  const operator = getAccount(seeded.account.id);
  if (!operator) throw new Error("operator missing");
  const resellerJoin = signUp({ name: "Reseller", email: "reseller@xvaisle.test", password: "market-test" });
  const supplierJoin = signUp({ name: "Supplier", email: "supplier@xvaisle.test", password: "market-test" });
  if ("error" in resellerJoin || "error" in supplierJoin) throw new Error("accounts");
  assert(getAccount(first.account.id)?.role === "buyer", "a later admin email does not promote earlier accounts");
  const resellerRole = setOwnRole(resellerJoin.account.id, "reseller");
  const supplierRole = setOwnRole(supplierJoin.account.id, "supplier");
  if ("error" in resellerRole || "error" in supplierRole) throw new Error("roles");

  const deniedReturns = saveReturnsFor(resellerRole.account, "100 Example Street, Sample City, ST 00000");
  assert("error" in deniedReturns && deniedReturns.status === 403, "a reseller cannot change the return address");
  const savedReturns = saveReturnsFor(operator, "100 Example Street, Sample City, ST 00000");
  assert(!("error" in savedReturns) && savedReturns.status === 200, "the operator can save the return address");
  const note = addInquiry({ name: "Example Buyer", email: "buyer@example.com", message: "Where is the pan?" });
  if ("error" in note) throw new Error(note.error);
  const hidden = inquiriesFor(resellerRole.account);
  assert("error" in hidden && hidden.status === 403, "buyer notes are not for listing owners");
  const visible = inquiriesFor(operator);
  assert(!("error" in visible) && visible.inquiries.length === 1, "the operator can read buyer notes");

  const deniedCatalog = createCatalogItem(resellerRole.account, {
    sku: "NO",
    title: "Not a supplier",
    costCents: 100,
    shippingCents: 0,
    origin: "US",
  });
  assert("error" in deniedCatalog, "a reseller cannot set a supplier price");
  const catalog = createCatalogItem(supplierRole.account, {
    sku: "PAN-1",
    title: "Quarter sheet pan",
    costCents: 500,
    shippingCents: 0,
    origin: "Elizabeth, NJ",
  });
  const expensive = createCatalogItem(supplierRole.account, {
    sku: "PAN-X",
    title: "Expensive pan",
    costCents: 5000,
    shippingCents: 0,
    origin: "Elizabeth, NJ",
  });
  if ("error" in catalog || "error" in expensive) throw new Error("catalog");
  assert(catalog.item.approved === false, "a supplier submission waits for review");
  const noTotp = reviewCatalogItem(operator, catalog.item.id, true);
  assert("error" in noTotp && noTotp.status === 403, "an admin without an authenticator cannot approve a product");
  const started = startTotp(operator.id);
  if ("error" in started) throw new Error(started.error);
  const totpOn = confirmTotp(operator.id, totpCode(started.secret));
  if ("error" in totpOn) throw new Error(totpOn.error);
  const admin = getAccount(operator.id);
  if (!admin?.totpEnabled) throw new Error("authenticator did not turn on");
  const approvedCatalog = reviewCatalogItem(admin, catalog.item.id, true);
  const approvedExpensive = reviewCatalogItem(admin, expensive.item.id, true);
  assert(!("error" in approvedCatalog) && !("error" in approvedExpensive), "an admin with an authenticator can approve products");
  const page = {
    productId: "pan",
    sku: "PAN-1",
    title: "Quarter sheet pan",
    description: "One pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Ignored",
    supplierOrigin: "Ignored",
    shipDaysMin: 2,
    shipDaysMax: 4,
    catalogItemId: catalog.item.id,
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
  const tooHigh = publishForAccount(getAccount(resellerJoin.account.id)!, {
    ...page,
    productId: "pricey",
    catalogItemId: expensive.item.id,
  });
  assert(tooHigh.status === 400, "a listing that pays the reseller less than zero is rejected");
  const listed = publishForAccount(getAccount(resellerJoin.account.id)!, page);
  assert(listed.status === 200 && listed.listing?.supplierCostCents === 500, "cost comes from the supplier catalog");
  assert(listed.listing?.supplierAccountId === supplierJoin.account.id, "the supplier is the catalog owner");
  getDb().prepare("UPDATE accounts SET role = 'buyer' WHERE id = ?").run(supplierJoin.account.id);
  const wrongRole = publishForAccount(getAccount(resellerJoin.account.id)!, { ...page, productId: "role-pan" });
  assert(wrongRole.status === 400, "the supplier account must have the supplier role");
  getDb().prepare("UPDATE accounts SET role = 'supplier' WHERE id = ?").run(supplierJoin.account.id);
  const ownId = "cat-own";
  getDb()
    .prepare(
      `INSERT INTO supplier_catalog (
         id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
       ) VALUES (?, ?, 'OWN', 'Own goods', 100, 0, 'US', 1, ?)`,
    )
    .run(ownId, resellerJoin.account.id, Date.now());
  const ownSupply = publishForAccount(getAccount(resellerJoin.account.id)!, {
    ...page,
    productId: "own-pan",
    catalogItemId: ownId,
  });
  assert(ownSupply.status === 400, "a reseller cannot be their own supplier");

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
  const unverifiedAdmin = getAccount(first.account.id);
  if (!unverifiedAdmin) throw new Error("first account");
  getDb().prepare("UPDATE accounts SET role = 'admin' WHERE id = ?").run(first.account.id);
  const unverified = getAccount(first.account.id);
  const blockedAdmin = await deliverFor(unverified, order.order.id);
  assert("error" in blockedAdmin && blockedAdmin.status === 403, "an unverified admin cannot release or deliver");
  getDb().prepare("UPDATE accounts SET role = 'buyer' WHERE id = ?").run(first.account.id);
  const missingTracking = await deliverFor(operator, order.order.id);
  assert("error" in missingTracking && missingTracking.status === 400, "delivery requires a carrier and tracking number");
  const shipped = markShipped(order.order.id, "UPS", "1Z999AA10123456784");
  if ("error" in shipped) throw new Error(shipped.error);
  const delivered = await deliverFor(operator, order.order.id);
  assert(!("error" in delivered), "the operator can mark delivery");
  assert(!calls.some((call) => call.url.includes("/v1/transfers")), "delivery does not transfer yet");
  const confirmed = await confirmReceipt(order.receiptToken);
  if ("error" in confirmed) throw new Error(confirmed.error);
  const transfers = calls.filter((call) => call.method === "POST" && call.url.includes("/v1/transfers") && !call.url.includes("reversals"));
  assert(transfers.length === 2, "buyer confirmation creates two transfers");
  assert(
    transfers.every((call) => /transfer-.+-(reseller|supplier)-\d+$/.test(call.idempotency ?? "")),
    "transfer idempotency includes the amount",
  );
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
  const updated = await acceptStripeEvent(updatedRaw, sign(updatedRaw, "whsec_connect"), "whsec_connect", "connect");
  assert(updated.status === 200, "account.updated");
  const supplierRow = db.prepare("SELECT transfers_status, payouts_enabled FROM connected_accounts WHERE stripe_account_id = ?").get(
    "acct_supplier",
  ) as { transfers_status: string; payouts_enabled: number };
  assert(supplierRow.transfers_status === "active" && supplierRow.payouts_enabled === 1, "capability status is stored");
  await acceptStripeEvent(updatedRaw, sign(updatedRaw, "whsec_connect"), "whsec_connect", "connect");
  assert(accountFetches() === beforeFetch + 1, "account.updated replay does not fetch again");
  db.prepare("UPDATE connected_accounts SET payouts_enabled = 0, transfers_status = 'pending' WHERE stripe_account_id = ?").run(
    "acct_supplier",
  );
  const v2Raw = JSON.stringify({
    id: "evt_v2_acct",
    type: "v2.core.account.updated",
    related_object: { id: "acct_supplier", type: "v2.core.account" },
  });
  const v2 = await acceptStripeEvent(v2Raw, sign(v2Raw, "whsec_connect"), "whsec_connect", "connect");
  assert(v2.status === 200, "v2 account event is accepted");
  const v2Row = db.prepare("SELECT transfers_status FROM connected_accounts WHERE stripe_account_id = ?").get("acct_supplier") as {
    transfers_status: string;
  };
  assert(v2Row.transfers_status === "active", "v2 account id is read from related_object.id");
  const connectRefund = JSON.stringify({
    id: "evt_connect_refund",
    type: "charge.refunded",
    account: "acct_supplier",
    data: { object: { id: "ch_cs_paid", payment_intent: "pi_cs_paid", amount: 100, amount_refunded: 100 } },
  });
  const ignoredRefund = await acceptStripeEvent(connectRefund, sign(connectRefund, "whsec_connect"), "whsec_connect", "connect");
  assert(
    ignoredRefund.status === 200 && "ignored" in ignoredRefund.body && ignoredRefund.body.ignored === true,
    "connect endpoint ignores charge events",
  );
  const platformLeak = JSON.stringify({
    id: "evt_platform_leak",
    type: "charge.refunded",
    account: "acct_supplier",
    data: { object: { id: "ch_cs_paid", payment_intent: "pi_cs_paid", amount: order.order.amountCents, amount_refunded: 1 } },
  });
  const ignoredLeak = await acceptStripeEvent(platformLeak, sign(platformLeak, "whsec_billing"), "whsec_billing", "platform");
  assert(
    ignoredLeak.status === 200 && "ignored" in ignoredLeak.body && ignoredLeak.body.ignored === true,
    "a connected-account charge is not applied as a platform event",
  );
  const goneRaw = JSON.stringify({
    id: "evt_gone",
    type: "account.application.deauthorized",
    account: "acct_supplier",
    data: { object: { id: "ca_test" } },
  });
  await acceptStripeEvent(goneRaw, sign(goneRaw, "whsec_connect"), "whsec_connect", "connect");
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
    supplierCostCents: 500,
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
  const riskShip = markShipped(risky.order.id, "UPS", "1Z999AA10123456785");
  if ("error" in riskShip) throw new Error(riskShip.error);
  await markDelivered(risky.order.id);
  const riskConfirm = await confirmReceipt(risky.receiptToken);
  if ("error" in riskConfirm) throw new Error(riskConfirm.error);
  const held = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  assert(held === beforeRiskTransfers, "elevated risk does not transfer");
  const approved = await approveFor(getAccount(operator.id), risky.order.id);
  assert(!("error" in approved), "admin can approve");
  const released = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  assert(released === held + 2, "approval releases the two shares");

  const disputePage = publishListing(resellerJoin.account.id, {
    ...page,
    productId: "dispute-pan",
    sku: "PAN-D",
    supplierAccountId: supplierJoin.account.id,
    supplierCostCents: 500,
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
  const disputeShip = markShipped(disputedOrder.order.id, "UPS", "1Z999AA10123456786");
  if ("error" in disputeShip) throw new Error(disputeShip.error);
  await markDelivered(disputedOrder.order.id);
  const disputeConfirm = await confirmReceipt(disputedOrder.receiptToken);
  if ("error" in disputeConfirm) throw new Error(disputeConfirm.error);
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
  const history = db
    .prepare("SELECT transfer_id, kind FROM ledger_transfers WHERE order_id = ?")
    .all(disputedOrder.order.id) as { transfer_id: string; kind: string }[];
  const historyIds = new Set(history.map((row) => row.transfer_id));
  assert(history.filter((row) => row.kind === "transfer").length === 2, "the original transfers stay on record");
  assert(history.filter((row) => row.kind === "restore").length === 2, "the restored transfers are added");
  assert(historyIds.size === 4, "a won dispute does not overwrite the transfer id");

  const rotated = rotateSupplierSecret(supplierJoin.account.id);
  if ("error" in rotated) throw new Error(rotated.error);
  const callback = JSON.stringify({
    orderId: disputedOrder.order.id,
    supplierAccountId: supplierJoin.account.id,
    carrier: "UPS",
    tracking: "1Z999AA10123456787",
    delivered: true,
  });
  const wrong = await acceptSupplierDelivery(callback, "not-the-secret");
  assert(wrong.status === 403, "supplier callback rejects a bad secret");
  const right = await acceptSupplierDelivery(callback, rotated.secret);
  assert(right.status === 200, "a supplier secret can mark shipment");
  const rotatedAgain = rotateSupplierSecret(supplierJoin.account.id);
  if ("error" in rotatedAgain) throw new Error(rotatedAgain.error);
  const staleSecret = await acceptSupplierDelivery(callback, rotated.secret);
  assert(staleSecret.status === 403, "rotating the secret retires the old one");

  subscriptionAccountId = resellerJoin.account.id;
  db.prepare("UPDATE accounts SET stripe_subscription_id = ?, member_since = NULL, membership_status = NULL WHERE id = ?").run(
    "sub_member",
    resellerJoin.account.id,
  );
  subscriptionStatus = "active";
  const staleSub = JSON.stringify({
    id: "evt_sub_stale",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_member", status: "canceled", customer: "cus_test" } },
  });
  await acceptStripeEvent(staleSub, sign(staleSub, "whsec_billing"), "whsec_billing", "platform");
  const stillActive = db.prepare("SELECT membership_status, member_since FROM accounts WHERE id = ?").get(resellerJoin.account.id) as {
    membership_status: string;
    member_since: number | null;
  };
  assert(stillActive.membership_status === "active" && stillActive.member_since, "a stale canceled event does not override Stripe");
  subscriptionStatus = "trialing";
  const trialSub = JSON.stringify({
    id: "evt_sub_trial",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_member", status: "canceled", customer: "cus_test" } },
  });
  await acceptStripeEvent(trialSub, sign(trialSub, "whsec_billing"), "whsec_billing", "platform");
  const trialing = getAccount(resellerJoin.account.id);
  assert(trialing?.membershipStatus === "trialing" && hasActiveMembership(trialing), "trialing counts as active");

  const numbers = db.prepare("SELECT number FROM orders ORDER BY created_at").all() as { number: string }[];
  assert(numbers.length >= 2, "orders exist");
  assert(new Set(numbers.map((row) => row.number)).size === numbers.length, "order numbers are unique");
  assert(numbers.every((row) => /^XV-\d+$/.test(row.number)), "order numbers are allocated");

  const stuckId = order.order.id;
  db.prepare(
    "UPDATE orders SET status = 'fulfilling', supplier_ref = NULL, fulfilling_started_at = ?, fulfillment_attempts = 0, fulfillment_flag = NULL WHERE id = ?",
  ).run(Date.now() - 20 * 60 * 1000, stuckId);
  const shipsBefore = ships;
  await sweepStuckFulfillment();
  assert(ships === shipsBefore + 1, "a stuck fulfillment is retried once");
  db.prepare(
    "UPDATE orders SET status = 'fulfilling', supplier_ref = 'SUP-1', fulfilling_started_at = ? WHERE id = ?",
  ).run(Date.now() - 20 * 60 * 1000, stuckId);
  await sweepStuckFulfillment();
  const flagged = db.prepare("SELECT fulfillment_flag FROM orders WHERE id = ?").get(stuckId) as { fulfillment_flag: string };
  assert(flagged.fulfillment_flag === "stuck", "a fulfillment that already shipped is flagged");

  db.prepare("UPDATE orders SET paid_at = ?, refund_required = 0 WHERE id = ?").run(Date.now() - (730 * 24 * 60 * 60 * 1000 + 1000), stuckId);
  flagRefundDeadlines();
  const refundFlag = db.prepare("SELECT refund_required FROM orders WHERE id = ?").get(stuckId) as { refund_required: number };
  assert(refundFlag.refund_required === 1, "orders past the hold window are flagged for refund");

  const windowOrder = createPendingOrder({
    productId: "pan",
    qty: 1,
    ship: {
      name: "Window Buyer",
      email: "window@example.com",
      line1: "100 Example Street",
      city: "Sample City",
      region: "ST",
      postal: "00000",
      country: "US",
    },
  });
  if ("error" in windowOrder) throw new Error(windowOrder.error);
  active = { id: windowOrder.order.id, amountCents: windowOrder.order.amountCents, accountId: windowOrder.order.accountId };
  risk = "normal";
  const windowPay = JSON.stringify({
    id: "evt_window",
    type: "checkout.session.completed",
    data: { object: { id: "cs_window" } },
  });
  await acceptStripeEvent(windowPay, sign(windowPay, "whsec_billing"), "whsec_billing", "platform");
  const windowShip = markShipped(windowOrder.order.id, "UPS", "1Z999AA10123456788");
  if ("error" in windowShip) throw new Error(windowShip.error);
  await markDelivered(windowOrder.order.id);
  const disputedReceipt = await disputeReceipt(windowOrder.receiptToken, "The box arrived dented.");
  if ("error" in disputedReceipt) throw new Error(disputedReceipt.error);
  const beforeWindow = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  await releaseMatured(Date.now() + 8 * 24 * 60 * 60 * 1000);
  const duringDispute = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  assert(duringDispute === beforeWindow, "a buyer dispute freezes the payout");
  const reviewed = await approveFor(getAccount(operator.id), windowOrder.order.id);
  assert(!("error" in reviewed), "an admin can review a buyer dispute");
  const afterReview = calls.filter((call) => call.url.includes("/v1/transfers") && !call.url.includes("reversals")).length;
  assert(afterReview === duringDispute + 2, "admin review releases the frozen payout");

  const cli = spawnSync(process.execPath, ["scripts/admin-create.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_PATH: process.env.DATABASE_PATH,
      ADMIN_EMAIL: "cli-admin@xvaisle.test",
      ADMIN_PASSWORD: "market-test",
      ADMIN_NAME: "CLI",
    },
    encoding: "utf8",
  });
  assert(cli.status === 0, cli.stderr || "admin:create failed");
  assert(!`${cli.stdout}${cli.stderr}`.includes("market-test"), "admin:create does not print the password");
  const cliRow = db.prepare("SELECT role, email_verified FROM accounts WHERE email = ?").get("cli-admin@xvaisle.test") as {
    role: string;
    email_verified: number;
  };
  assert(cliRow.role === "admin" && cliRow.email_verified === 1, "admin:create marks the operator verified");

  const second = signUp({ name: "Second Owner", email: "second-owner@xvaisle.test", password: "market-test" });
  if ("error" in second) throw new Error(second.error);
  const keptSince = Date.now();
  db.prepare("UPDATE accounts SET member_since = ?, membership_status = 'active', stripe_customer_id = ? WHERE id = ?").run(
    keptSince,
    "cus_keep",
    second.account.id,
  );
  const beforePromote = db.prepare(
    "SELECT name, password_hash, member_since, stripe_customer_id, role FROM accounts WHERE id = ?",
  ).get(second.account.id) as {
    name: string;
    password_hash: string;
    member_since: number;
    stripe_customer_id: string;
    role: string;
  };
  process.env.ADMIN_EMAILS = "second-owner@xvaisle.test,cli-admin@xvaisle.test";
  const promoted = seedAdmin({ email: "second-owner@xvaisle.test", password: "different-password" });
  if ("error" in promoted) throw new Error(promoted.error);
  const afterPromote = db.prepare(
    "SELECT name, password_hash, member_since, stripe_customer_id, role, email_verified FROM accounts WHERE id = ?",
  ).get(second.account.id) as {
    name: string;
    password_hash: string;
    member_since: number;
    stripe_customer_id: string;
    role: string;
    email_verified: number;
  };
  assert(afterPromote.role === "admin" && afterPromote.email_verified === 1, "an existing account can be promoted");
  assert(afterPromote.name === beforePromote.name, "promotion keeps the name");
  assert(afterPromote.password_hash === beforePromote.password_hash, "promotion keeps the password");
  assert(afterPromote.member_since === keptSince, "promotion keeps membership");
  assert(afterPromote.stripe_customer_id === "cus_keep", "promotion keeps the Stripe customer");
  const stillSignsIn = signIn({ email: "second-owner@xvaisle.test", password: "market-test" });
  assert(
    "account" in stillSignsIn && stillSignsIn.account?.role === "admin",
    "the old password still signs in",
  );
  assert(getAccount(operator.id)?.role === "admin", "promoting a second owner does not demote the first");
  const blocked = seedAdmin({ email: "stranger@xvaisle.test", password: "market-test" });
  assert("error" in blocked, "ADMIN_EMAILS allowlist refuses other emails");
  delete process.env.ADMIN_EMAILS;
  const stranger = db.prepare("SELECT role FROM accounts WHERE email = ?").get("stranger@xvaisle.test") as
    | { role: string }
    | undefined;
  assert(!stranger, "a refused allowlist email is not created");

  const promotedCli = spawnSync(process.execPath, ["scripts/admin-create.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_PATH: process.env.DATABASE_PATH,
      ADMIN_EMAIL: "second-owner@xvaisle.test",
      ADMIN_PASSWORD: "should-not-replace",
      ADMIN_NAME: "Replaced Name",
      ADMIN_EMAILS: "second-owner@xvaisle.test",
    },
    encoding: "utf8",
  });
  assert(promotedCli.status === 0, promotedCli.stderr || "promoting an existing account failed");
  assert(!`${promotedCli.stdout}${promotedCli.stderr}`.includes("should-not-replace"), "promotion does not print a password");
  const afterCli = db.prepare("SELECT name, password_hash, role FROM accounts WHERE id = ?").get(second.account.id) as {
    name: string;
    password_hash: string;
    role: string;
  };
  assert(afterCli.role === "admin" && afterCli.name === "Second Owner", "the script does not rename an existing account");
  assert(afterCli.password_hash === beforePromote.password_hash, "the script does not replace an existing password");
  const refusedCli = spawnSync(process.execPath, ["scripts/admin-create.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_PATH: process.env.DATABASE_PATH,
      ADMIN_EMAIL: "outsider@xvaisle.test",
      ADMIN_PASSWORD: "market-test",
      ADMIN_EMAILS: "second-owner@xvaisle.test",
    },
    encoding: "utf8",
  });
  assert(refusedCli.status !== 0, "admin:create refuses an email outside ADMIN_EMAILS");

  assert(!existsSync("src/app/api/account/payout/route.ts"), "raw payout collection is gone");
  const accounts = await import("../src/lib/server/accounts");
  assert(!("savePayout" in accounts), "the server does not accept payout numbers");
  const lock = signUp({ name: "Lock", email: "lock@xvaisle.test", password: "market-test" });
  if ("error" in lock) throw new Error(lock.error);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const miss = signIn({ email: "lock@xvaisle.test", password: "wrong-pass" });
    assert("error" in miss, "a wrong password fails");
  }
  const locked = signIn({ email: "lock@xvaisle.test", password: "market-test" });
  assert("error" in locked, "five failed sign-ins lock the account");

  global.fetch = originalFetch;
  setStripeFetch(null);
  closeDb();
  console.log("connect checks ok");
}

main();
