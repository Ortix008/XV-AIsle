import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-fees-")), "market.sqlite");
delete process.env.PLATFORM_FEE_BPS;
delete process.env.STRIPE_FEE_BPS;
delete process.env.STRIPE_FEE_FIXED_CENTS;
delete process.env.STRIPE_DISPUTE_FEE_CENTS;
delete process.env.MIN_RETAIL_CENTS;
delete process.env.MIN_RESELLER_NET_CENTS;
delete process.env.SUPPLIER_API_URL;
delete process.env.SUPPLIER_API_KEY;
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

async function main() {
  const fees = await import("../src/lib/server/fees");
  assert(fees.stripeFeeBps() === 290, "stripe percentage defaults to 2.9%");
  assert(fees.stripeFeeFixedCents() === 30, "stripe fixed fee defaults to 30 cents");
  assert(fees.stripeDisputeFeeCents() === 1500, "dispute fee defaults to $15");
  assert(fees.minRetailCents() === 500, "retail minimum defaults to $5");
  assert(fees.minResellerNetCents() === 50, "reseller minimum defaults to 50 cents");
  process.env.STRIPE_FEE_BPS = "5000";
  assert(fees.stripeFeeBps() === 1000, "stripe percentage above 10% clamps");
  process.env.STRIPE_FEE_BPS = "nope";
  assert(fees.stripeFeeBps() === 290, "a non-integer stripe percentage falls back");
  delete process.env.STRIPE_FEE_BPS;
  process.env.STRIPE_FEE_FIXED_CENTS = "-5";
  assert(fees.stripeFeeFixedCents() === 0, "a negative fixed fee clamps to zero");
  delete process.env.STRIPE_FEE_FIXED_CENTS;
  process.env.STRIPE_DISPUTE_FEE_CENTS = "9000";
  assert(fees.stripeDisputeFeeCents() === 3500, "a high dispute fee clamps");
  delete process.env.STRIPE_DISPUTE_FEE_CENTS;
  process.env.MIN_RETAIL_CENTS = "50";
  assert(fees.minRetailCents() === 100, "retail minimum clamps to $1");
  delete process.env.MIN_RETAIL_CENTS;

  const rounded = fees.quoteSplit({
    priceCents: 2695,
    qty: 1,
    supplierCostCents: 200,
    supplierShippingCents: 0,
    feeBps: 1000,
  });
  assert(rounded.platformFeeCents === 270, "half a cent of platform fee rounds away from zero");
  assert(rounded.stripeFeeCents === 108, "stripe estimate rounds the percentage then adds 30 cents");
  assert(rounded.resellerAmountCents === 2117, "reseller net uses the rounded fees");
  const two = fees.quoteSplit({
    priceCents: 2695,
    qty: 2,
    supplierCostCents: 500,
    supplierShippingCents: 100,
    feeBps: 1000,
  });
  assert(two.grossCents === 5390, "gross is price times quantity");
  assert(two.supplierAmountCents === 1100, "supplier shipping is charged once");
  assert(two.stripeFeeCents === 186, "the fixed stripe fee is once per charge");
  assert(two.resellerAmountCents === 5390 - 539 - 1100 - 186, "qty 2 reseller net");

  const samples = [
    { price: 500, platform: 50, stripe: 45, reseller: 205 },
    { price: 1000, platform: 100, stripe: 59, reseller: 641 },
    { price: 2500, platform: 250, stripe: 103, reseller: 1947 },
    { price: 10000, platform: 1000, stripe: 320, reseller: 8480 },
  ];
  for (const sample of samples) {
    const split = fees.quoteSplit({
      priceCents: sample.price,
      qty: 1,
      supplierCostCents: 200,
      supplierShippingCents: 0,
      feeBps: 1000,
    });
    assert(split.platformFeeCents === sample.platform, `platform fee at ${sample.price}`);
    assert(split.stripeFeeCents === sample.stripe, `stripe fee at ${sample.price}`);
    assert(split.resellerAmountCents === sample.reseller, `reseller net at ${sample.price}`);
    for (const refunded of [sample.price, Math.round(sample.price / 2)]) {
      const claw = fees.refundClawback({
        grossCents: split.grossCents,
        refundedCents: refunded,
        platformFeeCents: split.platformFeeCents,
        stripeFeeCents: split.stripeFeeCents,
        supplierAmountCents: split.supplierAmountCents,
        resellerAmountCents: split.resellerAmountCents,
      });
      const net = fees.platformNetCents({
        grossCents: split.grossCents,
        stripeFeeCents: split.stripeFeeCents,
        refundedCents: refunded,
        disputeKeptCents: 0,
        disputeFeeKeptCents: 0,
        supplierKeptCents: split.supplierAmountCents - claw.supplierReverseCents,
        resellerKeptCents: split.resellerAmountCents - claw.resellerReverseCents,
        debtCents: claw.debtCents,
      });
      assert(net >= 0, `refund of ${refunded} on ${sample.price} stays non-negative`);
    }
    const lost = fees.disputeClawback({
      grossCents: split.grossCents,
      disputedCents: split.grossCents,
      platformFeeCents: split.platformFeeCents,
      stripeFeeCents: split.stripeFeeCents,
      supplierAmountCents: split.supplierAmountCents,
      resellerAmountCents: split.resellerAmountCents,
      disputeFeeCents: 1500,
    });
    const lostNet = fees.platformNetCents({
      grossCents: split.grossCents,
      stripeFeeCents: split.stripeFeeCents,
      refundedCents: 0,
      disputeKeptCents: split.grossCents,
      disputeFeeKeptCents: 1500,
      supplierKeptCents: split.supplierAmountCents - lost.supplierReverseCents,
      resellerKeptCents: split.resellerAmountCents - lost.resellerReverseCents,
      debtCents: lost.debtCents,
    });
    assert(lostNet >= 0, `lost dispute on ${sample.price} stays non-negative`);
    const wonNet = fees.platformNetCents({
      grossCents: split.grossCents,
      stripeFeeCents: split.stripeFeeCents,
      refundedCents: 0,
      disputeKeptCents: 0,
      disputeFeeKeptCents: 0,
      supplierKeptCents: split.supplierAmountCents,
      resellerKeptCents: split.resellerAmountCents,
      debtCents: 0,
    });
    assert(wonNet === split.platformFeeCents, `won dispute on ${sample.price} keeps the platform fee`);
  }

  const replaced = fees.splitWithStripeFee(rounded, 80);
  assert(replaced.stripeFeeCents === 80, "the actual fee replaces the estimate");
  assert(replaced.platformFeeCents === rounded.platformFeeCents, "the actual fee does not change the platform fee");
  assert(
    replaced.resellerAmountCents === rounded.grossCents - rounded.platformFeeCents - rounded.supplierAmountCents - 80,
    "reseller net uses the actual fee",
  );

  const { getDb } = await import("../src/lib/server/db");
  const { getAccount, setOwnRole, signUp } = await import("../src/lib/server/accounts");
  const { publishForAccount, quoteForAccount } = await import("../src/lib/server/publish");
  const { createPendingOrder, getOrder, listPublished, markShipped } = await import("../src/lib/server/store");
  const { applyDisputeClosed, applyDisputeOpened, applyRefund, confirmReceipt, markDelivered, resellerDebtCents, settleCheckoutSession } =
    await import("../src/lib/server/ledger");
  const { setStripeFetch } = await import("../src/lib/server/stripe");

  const resellerJoin = signUp({ name: "Reseller", email: "reseller-fees@xvaisle.test", password: "market-test" });
  const supplierJoin = signUp({ name: "Supplier", email: "supplier-fees@xvaisle.test", password: "market-test" });
  if ("error" in resellerJoin || "error" in supplierJoin) throw new Error("accounts");
  const resellerRole = setOwnRole(resellerJoin.account.id, "reseller");
  const supplierRole = setOwnRole(supplierJoin.account.id, "supplier");
  if ("error" in resellerRole || "error" in supplierRole || !resellerRole.account) throw new Error("roles");
  getDb()
    .prepare("UPDATE accounts SET member_since = ?, membership_status = 'active' WHERE id = ?")
    .run(Date.now(), resellerJoin.account.id);
  const db = getDb();
  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, 'acct_fee_reseller', 0, 1, 1, '', 'active', ?)`,
  ).run(resellerJoin.account.id, Date.now());
  db.prepare(
    `INSERT INTO connected_accounts (
       account_id, stripe_account_id, charges_enabled, payouts_enabled, details_submitted, requirements_due, transfers_status, updated_at
     ) VALUES (?, 'acct_fee_supplier', 0, 1, 1, '', 'active', ?)`,
  ).run(supplierJoin.account.id, Date.now());
  db.prepare(
    `INSERT INTO supplier_catalog (
       id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
     ) VALUES ('cat-fee', ?, 'FEE-1', 'Fee pan', 200, 0, 'Elizabeth, NJ', 1, ?)`,
  ).run(supplierJoin.account.id, Date.now());
  db.prepare(
    `INSERT INTO supplier_catalog (
       id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
     ) VALUES ('cat-thin', ?, 'FEE-2', 'Thin margin', 356, 0, 'Elizabeth, NJ', 1, ?)`,
  ).run(supplierJoin.account.id, Date.now());
  db.prepare(
    `INSERT INTO supplier_catalog (
       id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
     ) VALUES ('cat-ok', ?, 'FEE-3', 'Just enough', 355, 0, 'Elizabeth, NJ', 1, ?)`,
  ).run(supplierJoin.account.id, Date.now());

  const reseller = getAccount(resellerJoin.account.id);
  if (!reseller) throw new Error("reseller missing");
  const base = {
    sku: "FEE-1",
    title: "Fee pan",
    description: "One pan.",
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Ignored",
    supplierOrigin: "Ignored",
    shipDaysMin: 2,
    shipDaysMax: 4,
    catalogItemId: "cat-fee",
  };
  const cheap = publishForAccount(reseller, { ...base, productId: "cheap-pan", priceCents: 499 });
  assert(cheap.status === 400 && cheap.error?.includes("$5.00"), "a price under $5 is rejected");
  const thin = publishForAccount(reseller, {
    ...base,
    productId: "thin-pan",
    priceCents: 500,
    catalogItemId: "cat-thin",
  });
  assert(thin.status === 400 && thin.error?.includes("$0.50"), "a payout under 50 cents is rejected");
  const enough = publishForAccount(reseller, {
    ...base,
    productId: "enough-pan",
    priceCents: 500,
    catalogItemId: "cat-ok",
    feeBps: 800,
    platformFeeCents: 1,
    stripeFeeCents: 1,
    resellerAmountCents: 1,
    supplierAmountCents: 1,
  });
  assert(enough.status === 200, "50 cents of reseller net is allowed");
  assert(enough.listing?.feeBps === 1000, "a client fee basis is ignored");
  assert(enough.listing?.supplierCostCents === 355, "a client supplier amount is ignored");
  assert(enough.listing?.priceCents === 500, "the server keeps the submitted price");

  const quote = quoteForAccount({ catalogItemId: "cat-fee", priceCents: 1000 });
  if (quote.status !== 200) throw new Error(quote.error);
  assert(quote.quote.supplierCostCents === 200, "the quote uses the catalog cost");
  assert(quote.quote.platformFeeCents === 100, "the quote platform fee is server-side");
  assert(quote.quote.stripeFeeCents === 59, "the quote stripe fee is server-side");
  assert(quote.quote.resellerNetCents === 641, "the quote payout is server-side");

  process.env.PLATFORM_FEE_BPS = "1100";
  const overridden = publishForAccount(reseller, {
    ...base,
    productId: "override-pan",
    priceCents: 2695,
    feeBps: 800,
  });
  assert(overridden.status === 200 && overridden.listing?.feeBps === 1100, "the listing stores the server fee");
  delete process.env.PLATFORM_FEE_BPS;

  const listed = publishForAccount(reseller, { ...base, productId: "live-pan", priceCents: 2695 });
  if (listed.status !== 200 || !listed.listing) throw new Error("listing");
  const pending = createPendingOrder({ productId: "live-pan", qty: 1, ship });
  if ("error" in pending) throw new Error(pending.error);
  const estimate = pending.order.stripeFeeEstCents;
  assert(estimate === 108 && pending.order.stripeFeeCents === 108, "checkout stores the stripe estimate");
  assert(pending.order.resellerAmountCents === 2695 - 270 - 200 - 108, "checkout reseller net uses the estimate");
  db.prepare("UPDATE listings SET fee_bps = 800 WHERE product_id = 'live-pan'").run();
  const second = createPendingOrder({ productId: "live-pan", qty: 1, ship });
  if ("error" in second) throw new Error(second.error);
  assert(second.order.feeBps === 1000, "checkout recomputes the platform fee from config");

  process.env.STRIPE_SECRET_KEY = "sk_test_fees";
  const calls: { url: string; idempotency: string | null; body: string }[] = [];
  setStripeFetch(async (url, init) => {
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body = typeof raw === "string" ? raw : raw instanceof URLSearchParams ? raw.toString() : "";
    calls.push({ url: String(url), idempotency: headers.get("Idempotency-Key"), body });
    if ((init?.method ?? "GET") === "POST" && !headers.get("Idempotency-Key")) {
      return Response.json({ error: { message: "missing idempotency" } }, { status: 400 });
    }
    if (String(url).includes("/reversals")) return Response.json({ id: "trr_fee" });
    if (String(url).includes("/v1/transfers")) return Response.json({ id: `tr_${calls.length}` });
    return Response.json({ id: "pi_fee", latest_charge: { id: "ch_fee", outcome: { risk_level: "normal", type: "authorized" } } });
  });

  const settled = await settleCheckoutSession({
    id: "cs_fee",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: pending.order.amountCents,
    metadata: { kind: "order", order_id: pending.order.id, account_id: pending.order.accountId },
    payment_intent: {
      id: "pi_fee",
      latest_charge: {
        id: "ch_fee",
        outcome: { risk_level: "normal", type: "authorized" },
        balance_transaction: { fee: 80 },
      },
    },
  });
  if ("error" in settled) throw new Error(settled.error);
  const paid = getOrder(pending.order.id);
  assert(paid?.stripeFeeEstCents === 108, "the estimate is kept");
  assert(paid?.stripeFeeCents === 80, "the actual fee is stored");
  assert(paid?.platformFeeCents === 270, "the platform fee is unchanged by the actual stripe fee");
  assert(paid?.resellerAmountCents === 2695 - 270 - 200 - 80, "the ledger basis uses the actual fee");
  const resellerRow = db.prepare("SELECT amount_cents FROM ledger WHERE order_id = ? AND party = 'reseller'").get(pending.order.id) as {
    amount_cents: number;
  };
  assert(resellerRow.amount_cents === paid?.resellerAmountCents, "the pending reseller row matches the actual fee");

  await applyRefund({
    chargeId: "ch_fee",
    paymentIntentId: "pi_fee",
    amountRefunded: 1000,
    gross: paid!.amountCents,
    eventKey: "evt_partial",
  });
  await applyRefund({
    chargeId: "ch_fee",
    paymentIntentId: "pi_fee",
    amountRefunded: paid!.amountCents,
    gross: paid!.amountCents,
    eventKey: "evt_full",
  });
  const debt = db.prepare("SELECT amount_cents, reversal_reason, status FROM ledger WHERE order_id = ? AND party = 'reseller_debt'").get(
    pending.order.id,
  ) as { amount_cents: number; reversal_reason: string; status: string };
  assert(debt.amount_cents === 270 + 80 && debt.reversal_reason === "refund_fee", "a full refund books the uncovered fee as debt");
  assert(resellerDebtCents(reseller.id) === debt.amount_cents, "open debt is the uncovered refund");
  const reasons = db.prepare("SELECT reason FROM ledger_transfers WHERE order_id = ?").all(pending.order.id) as { reason: string | null }[];
  assert(reasons.some((row) => row.reason === "refund_fee"), "refund fee recovery is on the ledger");
  const blocked = publishForAccount(reseller, { ...base, productId: "while-debt", priceCents: 2695 });
  assert(blocked.status === 400 && blocked.error?.includes("open balance"), "publishing is blocked while debt is open");

  const nextListing = listed.listing;
  if (!nextListing) throw new Error("listing missing");
  const follow = createPendingOrder({ productId: nextListing.productId, qty: 1, ship });
  if ("error" in follow) throw new Error(follow.error);
  const followPaid = await settleCheckoutSession({
    id: "cs_follow",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: follow.order.amountCents,
    metadata: { kind: "order", order_id: follow.order.id, account_id: follow.order.accountId },
    payment_intent: {
      id: "pi_follow",
      latest_charge: { id: "ch_follow", outcome: { risk_level: "normal", type: "authorized" } },
    },
  });
  if ("error" in followPaid) throw new Error(followPaid.error);
  const shipped = markShipped(follow.order.id, "UPS", "1Z999AA10123456784");
  if ("error" in shipped) throw new Error(shipped.error);
  const delivered = await markDelivered(follow.order.id);
  if ("error" in delivered) throw new Error(delivered.error);
  const confirmed = await confirmReceipt(follow.receiptToken);
  if ("error" in confirmed) throw new Error(confirmed.error);
  const expectedPay = (getOrder(follow.order.id)?.resellerAmountCents ?? 0) - (270 + 80);
  const resellerTransfer = calls.find(
    (call) =>
      call.url.includes("/v1/transfers") && !call.url.includes("reversals") && call.idempotency?.includes("-reseller-"),
  );
  assert(resellerTransfer?.body.includes(`amount=${expectedPay}`), "the next payout pays the reseller after the debt");
  assert(resellerTransfer?.idempotency?.endsWith(`-${expectedPay}`), "the payout idempotency key includes the amount");
  assert(resellerDebtCents(reseller.id) === 0, "the debt is offset on the next payout");
  const offset = db.prepare("SELECT reason, kind FROM ledger_transfers WHERE order_id = ? AND kind = 'debt_offset'").get(follow.order.id) as {
    reason: string;
    kind: string;
  };
  assert(offset.reason === "debt_offset", "the offset is on the ledger");
  const cleared = publishForAccount(reseller, { ...base, productId: "after-debt", priceCents: 2695 });
  assert(cleared.status === 200, "publishing resumes after the debt is offset");

  db.prepare("UPDATE supplier_catalog SET cost_cents = 5000 WHERE id = 'cat-fee'").run();
  const stale = createPendingOrder({ productId: "live-pan", qty: 1, ship });
  assert("error" in stale, "checkout rejects a listing that no longer clears the fees");
  const hidden = db.prepare("SELECT published FROM listings WHERE product_id = 'live-pan'").get() as { published: number };
  assert(hidden.published === 0, "a loss-making listing is paused");
  db.prepare("UPDATE listings SET published = 1 WHERE product_id = 'live-pan'").run();
  assert(!listPublished().some((item) => item.productId === "live-pan"), "a listing that no longer clears is hidden");
  db.prepare("UPDATE listings SET published = 0 WHERE product_id = 'live-pan'").run();

  db.prepare("UPDATE supplier_catalog SET cost_cents = 200 WHERE id = 'cat-fee'").run();
  const disputeListing = publishForAccount(reseller, { ...base, productId: "dispute-fee-pan", priceCents: 1000 });
  if (disputeListing.status !== 200) throw new Error(disputeListing.error ?? "dispute listing");
  const disputed = createPendingOrder({ productId: "dispute-fee-pan", qty: 1, ship });
  if ("error" in disputed) throw new Error(disputed.error);
  const disputePay = await settleCheckoutSession({
    id: "cs_dispute_fee",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: disputed.order.amountCents,
    metadata: { kind: "order", order_id: disputed.order.id, account_id: disputed.order.accountId },
    payment_intent: {
      id: "pi_dispute_fee",
      latest_charge: { id: "ch_dispute_fee", outcome: { risk_level: "normal", type: "authorized" } },
    },
  });
  if ("error" in disputePay) throw new Error(disputePay.error);
  const disputeShip = markShipped(disputed.order.id, "UPS", "1Z999AA10123456785");
  if ("error" in disputeShip) throw new Error(disputeShip.error);
  const disputeDelivered = await markDelivered(disputed.order.id);
  if ("error" in disputeDelivered) throw new Error(disputeDelivered.error);
  const disputeConfirmed = await confirmReceipt(disputed.receiptToken);
  if ("error" in disputeConfirmed) throw new Error(disputeConfirmed.error);
  await applyDisputeOpened({
    chargeId: "ch_dispute_fee",
    paymentIntentId: "pi_dispute_fee",
    amount: disputed.order.amountCents,
    disputeId: "dp_fee",
  });
  const disputeDebt = db.prepare("SELECT amount_cents, status FROM ledger WHERE order_id = ? AND party = 'dispute_debt'").get(
    disputed.order.id,
  ) as { amount_cents: number; status: string };
  assert(disputeDebt.status === "pending" && disputeDebt.amount_cents === 100 + 59 + 1500, "a dispute books the fee the reversal cannot cover");
  const reversal = calls.find((call) => call.url.includes("/reversals") && call.idempotency?.includes("dp_fee"));
  assert(reversal?.idempotency != null && /-\d+$/.test(reversal.idempotency), "a dispute reversal key includes the amount");
  await applyDisputeClosed({
    chargeId: "ch_dispute_fee",
    paymentIntentId: "pi_dispute_fee",
    status: "won",
    disputeId: "dp_fee",
    amount: disputed.order.amountCents,
  });
  assert(resellerDebtCents(reseller.id) === 0, "a won dispute credits the dispute balance back");
  const wonCredit = db.prepare("SELECT reason FROM ledger_transfers WHERE order_id = ? AND kind = 'credit'").all(disputed.order.id) as {
    reason: string;
  }[];
  assert(wonCredit.some((row) => row.reason === "dispute_fee"), "the returned dispute fee is credited to the reseller");

  const lostOrder = createPendingOrder({ productId: "after-debt", qty: 1, ship });
  if ("error" in lostOrder) throw new Error(lostOrder.error);
  const lostPay = await settleCheckoutSession({
    id: "cs_lost_fee",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: lostOrder.order.amountCents,
    metadata: { kind: "order", order_id: lostOrder.order.id, account_id: lostOrder.order.accountId },
    payment_intent: {
      id: "pi_lost_fee",
      latest_charge: { id: "ch_lost_fee", outcome: { risk_level: "normal", type: "authorized" } },
    },
  });
  if ("error" in lostPay) throw new Error(lostPay.error);
  await applyDisputeOpened({
    chargeId: "ch_lost_fee",
    paymentIntentId: "pi_lost_fee",
    amount: lostOrder.order.amountCents,
    disputeId: "dp_lost",
  });
  await applyDisputeClosed({
    chargeId: "ch_lost_fee",
    paymentIntentId: "pi_lost_fee",
    status: "lost",
    disputeId: "dp_lost",
    amount: lostOrder.order.amountCents,
  });
  const still = db.prepare("SELECT status, amount_cents FROM ledger WHERE order_id = ? AND party = 'dispute_debt'").get(lostOrder.order.id) as {
    status: string;
    amount_cents: number;
  };
  assert(still.status === "pending" && still.amount_cents > 0, "a lost dispute keeps the reseller debt");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
