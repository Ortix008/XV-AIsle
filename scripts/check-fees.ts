import { createHmac } from "node:crypto";
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
delete process.env.RESELLER_RESERVE_BPS;
delete process.env.RESELLER_RESERVE_DAYS;
delete process.env.RESELLER_RESERVE_CAP_CENTS;
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
  assert(fees.resellerReserveBps() === 1000, "reserve defaults to 10%");
  assert(fees.resellerReserveDays() === 120, "reserve defaults to 120 days");
  process.env.RESELLER_RESERVE_DAYS = "900";
  assert(fees.resellerReserveDays() === 700, "reserve days clamp under Stripe's 730-day hold");
  delete process.env.RESELLER_RESERVE_DAYS;
  assert(fees.resellerReserveDays() === 120, "reserve days fall back to 120");
  assert(fees.resellerReserveCapCents() === 10000, "reserve cap defaults to $100");
  assert(
    fees.reserveHoldCents({ payoutCents: 10000, heldCents: 0, bps: 1000, capCents: 10000 }) === 1000,
    "10% of a payout is held",
  );
  assert(
    fees.reserveHoldCents({ payoutCents: 10000, heldCents: 9500, bps: 1000, capCents: 10000 }) === 500,
    "the hold stops at the remaining cap",
  );
  assert(
    fees.reserveHoldCents({ payoutCents: 10000, heldCents: 10000, bps: 1000, capCents: 10000 }) === 0,
    "a full cap sends the payout in full",
  );
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
    const position = (input: {
      refundedCents: number;
      disputeKeptCents: number;
      disputeFeeKeptCents: number;
      supplierKeptCents: number;
      resellerKeptCents: number;
      receivableCents: number;
    }) => ({
      cashCents: fees.platformCashCents({
        grossCents: split.grossCents,
        stripeFeeCents: split.stripeFeeCents,
        refundedCents: input.refundedCents,
        disputeKeptCents: input.disputeKeptCents,
        disputeFeeKeptCents: input.disputeFeeKeptCents,
        supplierKeptCents: input.supplierKeptCents,
        resellerKeptCents: input.resellerKeptCents,
      }),
      receivableCents: input.receivableCents,
    });
    for (const refunded of [sample.price, Math.round(sample.price / 2)]) {
      const claw = fees.refundClawback({
        grossCents: split.grossCents,
        refundedCents: refunded,
        platformFeeCents: split.platformFeeCents,
        stripeFeeCents: split.stripeFeeCents,
        supplierAmountCents: split.supplierAmountCents,
        resellerAmountCents: split.resellerAmountCents,
      });
      const report = position({
        refundedCents: refunded,
        disputeKeptCents: 0,
        disputeFeeKeptCents: 0,
        supplierKeptCents: split.supplierAmountCents - claw.supplierReverseCents,
        resellerKeptCents: split.resellerAmountCents - claw.resellerReverseCents,
        receivableCents: claw.debtCents,
      });
      if (refunded === sample.price) {
        assert(report.cashCents === -sample.stripe, `full refund cash at ${sample.price} excludes uncollected debt`);
        assert(
          report.receivableCents === sample.platform + sample.stripe,
          `full refund receivable at ${sample.price} is the uncollected fee`,
        );
        assert(report.cashCents !== report.cashCents + report.receivableCents, "cash and receivable are separate");
      }
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
    const lostReport = position({
      refundedCents: 0,
      disputeKeptCents: split.grossCents,
      disputeFeeKeptCents: 1500,
      supplierKeptCents: split.supplierAmountCents - lost.supplierReverseCents,
      resellerKeptCents: split.resellerAmountCents - lost.resellerReverseCents,
      receivableCents: lost.debtCents,
    });
    assert(lostReport.cashCents === -(sample.stripe + 1500), `lost dispute cash at ${sample.price} excludes debt`);
    assert(
      lostReport.receivableCents === sample.platform + sample.stripe + 1500,
      `lost dispute receivable at ${sample.price} is uncollected`,
    );
    const wonReport = position({
      refundedCents: 0,
      disputeKeptCents: 0,
      disputeFeeKeptCents: 0,
      supplierKeptCents: split.supplierAmountCents,
      resellerKeptCents: split.resellerAmountCents,
      receivableCents: 0,
    });
    assert(wonReport.cashCents === split.platformFeeCents, `won dispute cash at ${sample.price} is the platform fee`);
    assert(wonReport.receivableCents === 0, `won dispute at ${sample.price} has no receivable`);
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
  const { createPendingOrder, getOrder, listHoldAlerts, listPublished, markShipped } = await import("../src/lib/server/store");
  const {
    applyDisputeClosed,
    applyDisputeOpened,
    applyRefund,
    confirmReceipt,
    markDelivered,
    releaseReserves,
    releaseTransfers,
    resellerDebtCents,
    resellerReserveHeldCents,
    resellerReserveSummary,
    settleCheckoutSession,
  } = await import("../src/lib/server/ledger");
  const { acceptStripeEvent } = await import("../src/lib/server/stripe-events");
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
  let failReversals = false;
  setStripeFetch(async (url, init) => {
    const headers = new Headers(init?.headers);
    const raw = init?.body;
    const body = typeof raw === "string" ? raw : raw instanceof URLSearchParams ? raw.toString() : "";
    calls.push({ url: String(url), idempotency: headers.get("Idempotency-Key"), body });
    if ((init?.method ?? "GET") === "POST" && !headers.get("Idempotency-Key")) {
      return Response.json({ error: { message: "missing idempotency" } }, { status: 400 });
    }
    if (String(url).includes("/reversals")) {
      if (failReversals) {
        return Response.json({ error: { message: "Insufficient funds in Stripe account." } }, { status: 400 });
      }
      return Response.json({ id: "trr_fee" });
    }
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
  const followReseller = getOrder(follow.order.id)?.resellerAmountCents ?? 0;
  const afterDebt = followReseller - (270 + 80);
  const followHold = fees.reserveHoldCents({
    payoutCents: afterDebt,
    heldCents: 0,
    bps: fees.resellerReserveBps(),
    capCents: fees.resellerReserveCapCents(),
  });
  const expectedPay = afterDebt - followHold;
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
  const reserveTowardDebt = db
    .prepare("SELECT COALESCE(SUM(amount_cents), 0) AS total FROM ledger_transfers WHERE kind = 'reserve_use' AND transfer_id LIKE 'reserve-use|dp_fee|account|%'")
    .get() as { total: number };
  assert(disputeDebt.status === "pending", "a dispute leaves the uncovered fee as debt");
  assert(
    disputeDebt.amount_cents + Number(reserveTowardDebt.total) === 100 + 59 + 1500,
    "reserve covers the dispute fee before the remainder becomes debt",
  );
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

  const stackListing = publishForAccount(reseller, { ...base, productId: "stack-pan", priceCents: 2695 });
  if (stackListing.status !== 200) throw new Error(stackListing.error ?? "stack listing");
  const refusedListing = publishForAccount(reseller, { ...base, productId: "refused-pan", priceCents: 1000 });
  if (refusedListing.status !== 200) throw new Error(refusedListing.error ?? "refused listing");
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

  const stacked = createPendingOrder({ productId: "stack-pan", qty: 1, ship });
  if ("error" in stacked) throw new Error(stacked.error);
  const stackPay = await settleCheckoutSession({
    id: "cs_stack",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: stacked.order.amountCents,
    metadata: { kind: "order", order_id: stacked.order.id, account_id: stacked.order.accountId },
    payment_intent: {
      id: "pi_stack",
      latest_charge: {
        id: "ch_stack",
        outcome: { risk_level: "normal", type: "authorized" },
        balance_transaction: { fee: 5000 },
      },
    },
  });
  if ("error" in stackPay) throw new Error(stackPay.error);
  const shortfall = db.prepare("SELECT amount_cents FROM ledger WHERE order_id = ? AND party = 'reseller_debt:stripe_fee'").get(
    stacked.order.id,
  ) as { amount_cents: number };
  assert(shortfall.amount_cents === 2775, "the fee shortfall is its own debt");
  await applyRefund({
    chargeId: "ch_stack",
    paymentIntentId: "pi_stack",
    amountRefunded: stacked.order.amountCents,
    gross: stacked.order.amountCents,
    eventKey: "evt_stack_refund",
  });
  await applyRefund({
    chargeId: "ch_stack",
    paymentIntentId: "pi_stack",
    amountRefunded: stacked.order.amountCents,
    gross: stacked.order.amountCents,
    eventKey: "evt_stack_refund",
  });
  const refundDebt = db.prepare("SELECT amount_cents FROM ledger WHERE order_id = ? AND party = 'reseller_debt'").get(
    stacked.order.id,
  ) as { amount_cents: number };
  assert(refundDebt.amount_cents > 0, "the refund books its own debt");
  assert(
    shortfall.amount_cents + refundDebt.amount_cents > Math.max(shortfall.amount_cents, refundDebt.amount_cents),
    "the refund debt is separate from the shortfall",
  );
  await applyDisputeOpened({
    chargeId: "ch_stack",
    paymentIntentId: "pi_stack",
    amount: stacked.order.amountCents,
    disputeId: "dp_stack",
  });
  await applyDisputeOpened({
    chargeId: "ch_stack",
    paymentIntentId: "pi_stack",
    amount: stacked.order.amountCents,
    disputeId: "dp_stack",
  });
  const disputePart = db.prepare("SELECT amount_cents FROM ledger WHERE order_id = ? AND party = 'dispute_debt'").get(
    stacked.order.id,
  ) as { amount_cents: number };
  const stackedSum = shortfall.amount_cents + refundDebt.amount_cents + disputePart.amount_cents;
  assert(resellerDebtCents(reseller.id) >= stackedSum, "shortfall, refund, and dispute debts add");
  assert(stackedSum > Math.max(shortfall.amount_cents, refundDebt.amount_cents, disputePart.amount_cents), "the sum is not the max");
  const stackedAgain = resellerDebtCents(reseller.id);
  await applyDisputeClosed({
    chargeId: "ch_stack",
    paymentIntentId: "pi_stack",
    status: "lost",
    disputeId: "dp_stack",
    amount: stacked.order.amountCents,
  });
  assert(resellerDebtCents(reseller.id) === stackedAgain, "replaying the dispute does not book it twice");

  async function payoutOrder(productId: string, sessionId: string, chargeId: string) {
    const created = createPendingOrder({ productId, qty: 1, ship });
    if ("error" in created) throw new Error(created.error);
    const paid = await settleCheckoutSession({
      id: sessionId,
      url: null,
      status: "complete",
      payment_status: "paid",
      customer: null,
      subscription: null,
      amount_total: created.order.amountCents,
      metadata: { kind: "order", order_id: created.order.id, account_id: created.order.accountId },
      payment_intent: {
        id: `pi_${sessionId}`,
        latest_charge: { id: chargeId, outcome: { risk_level: "normal", type: "authorized" } },
      },
    });
    if ("error" in paid) throw new Error(paid.error);
    const shipped = markShipped(created.order.id, "UPS", "1Z999AA10123456786");
    if ("error" in shipped) throw new Error(shipped.error);
    const delivered = await markDelivered(created.order.id);
    if ("error" in delivered) throw new Error(delivered.error);
    const confirmed = await confirmReceipt(created.receiptToken);
    if ("error" in confirmed) throw new Error(confirmed.error);
    return created;
  }

  const beforeRefuse = calls.length;
  clearBalances();
  const refused = await payoutOrder("refused-pan", "cs_refused", "ch_refused");
  const refusedReseller = getOrder(refused.order.id)?.resellerAmountCents ?? 0;
  const refusedReserve = db.prepare("SELECT amount_cents FROM ledger WHERE order_id = ? AND party = 'reserve'").get(refused.order.id) as {
    amount_cents: number;
  };
  assert(refusedReserve.amount_cents === Math.round(refusedReseller * 0.1), "the refused order held 10%");
  failReversals = true;
  const debtBeforeRefuse = resellerDebtCents(reseller.id);
  await applyRefund({
    chargeId: "ch_refused",
    paymentIntentId: "pi_cs_refused",
    amountRefunded: refused.order.amountCents,
    gross: refused.order.amountCents,
    eventKey: "evt_refused_hook",
  });
  const refusedGap = resellerDebtCents(reseller.id) - debtBeforeRefuse;
  await applyRefund({
    chargeId: "ch_refused",
    paymentIntentId: "pi_cs_refused",
    amountRefunded: refused.order.amountCents,
    gross: refused.order.amountCents,
    eventKey: "evt_refused_hook",
  });
  assert(resellerDebtCents(reseller.id) - debtBeforeRefuse === refusedGap, "replaying a refused reversal does not add debt");
  const failRow = db.prepare("SELECT amount_cents, reversal_reason FROM ledger WHERE order_id = ? AND party LIKE 'reseller_debt:fail:%'").get(
    refused.order.id,
  ) as { amount_cents: number; reversal_reason: string };
  assert(failRow.amount_cents > 0 && failRow.reversal_reason === "refund_fee", "a refused reversal is booked as debt");
  const secret = "whsec_fees";
  const refundBody = JSON.stringify({
    id: "evt_refused_hook",
    type: "charge.refunded",
    data: {
      object: {
        id: "ch_refused",
        payment_intent: "pi_cs_refused",
        amount: refused.order.amountCents,
        amount_refunded: refused.order.amountCents,
      },
    },
  });
  const stamp = Math.floor(Date.now() / 1000);
  const signature = `t=${stamp},v1=${createHmac("sha256", secret).update(`${stamp}.${refundBody}`).digest("hex")}`;
  const hook = await acceptStripeEvent(refundBody, signature, secret);
  assert(hook.status === 200, "the webhook completes when Stripe refuses the reversal");
  assert(resellerDebtCents(reseller.id) - debtBeforeRefuse === refusedGap, "the webhook does not add debt after the reversal was booked");
  const replayHook = await acceptStripeEvent(refundBody, signature, secret);
  assert(replayHook.status === 200 && "duplicate" in replayHook.body, "the webhook replay is a duplicate");
  assert(calls.length > beforeRefuse, "the reversal was attempted");
  failReversals = false;

  function clearBalances() {
    db.prepare(
      `UPDATE ledger
       SET status = 'reversed', reversed_cents = amount_cents
       WHERE party = 'reseller_debt' OR party = 'dispute_debt' OR party LIKE 'reseller_debt:%' OR party = 'reserve'`,
    ).run();
  }
  clearBalances();

  const seedListing = publishForAccount(reseller, { ...base, productId: "seed-pan", priceCents: 1000 });
  if (seedListing.status !== 200) throw new Error(seedListing.error ?? "seed listing");
  const offsetListing = publishForAccount(reseller, { ...base, productId: "offset-pan", priceCents: 10000 });
  if (offsetListing.status !== 200) throw new Error(offsetListing.error ?? "offset listing");
  const seed = createPendingOrder({ productId: "seed-pan", qty: 1, ship });
  if ("error" in seed) throw new Error(seed.error);
  const seedPay = await settleCheckoutSession({
    id: "cs_seed",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: seed.order.amountCents,
    metadata: { kind: "order", order_id: seed.order.id, account_id: seed.order.accountId },
    payment_intent: {
      id: "pi_seed",
      latest_charge: { id: "ch_seed", outcome: { risk_level: "normal", type: "authorized" } },
    },
  });
  if ("error" in seedPay) throw new Error(seedPay.error);
  await applyRefund({
    chargeId: "ch_seed",
    paymentIntentId: "pi_seed",
    amountRefunded: seed.order.amountCents,
    gross: seed.order.amountCents,
    eventKey: "evt_seed",
  });
  const olderDebt = db.prepare("SELECT id, amount_cents, reversed_cents FROM ledger WHERE order_id = ? AND party = 'reseller_debt'").get(
    seed.order.id,
  ) as { id: string; amount_cents: number; reversed_cents: number };
  const openBeforeOffset = resellerDebtCents(reseller.id);
  assert(openBeforeOffset > 0, "older debt is open before the next payout");
  const offsetOrder = await payoutOrder("offset-pan", "cs_offset", "ch_offset");
  assert(resellerDebtCents(reseller.id) < openBeforeOffset, "the next payout collects older debt");
  const offsetRow = db.prepare("SELECT reversed_cents FROM ledger WHERE id = ?").get(olderDebt.id) as { reversed_cents: number };
  const settledCents = offsetRow.reversed_cents - olderDebt.reversed_cents;
  assert(settledCents > 0, "part of the older debt was settled from the payout");
  await applyRefund({
    chargeId: "ch_offset",
    paymentIntentId: "pi_cs_offset",
    amountRefunded: offsetOrder.order.amountCents,
    gross: offsetOrder.order.amountCents,
    eventKey: "evt_offset_refund",
  });
  const reopened = db.prepare("SELECT status, reversed_cents, amount_cents FROM ledger WHERE id = ?").get(olderDebt.id) as {
    status: string;
    reversed_cents: number;
    amount_cents: number;
  };
  assert(reopened.status === "pending" && reopened.reversed_cents === olderDebt.reversed_cents, "refunding the offset payout reopens that debt");
  const afterReopen = resellerDebtCents(reseller.id);
  await applyRefund({
    chargeId: "ch_offset",
    paymentIntentId: "pi_cs_offset",
    amountRefunded: offsetOrder.order.amountCents,
    gross: offsetOrder.order.amountCents,
    eventKey: "evt_offset_refund",
  });
  assert(resellerDebtCents(reseller.id) === afterReopen, "replaying the refund does not reopen the debt twice");

  clearBalances();
  process.env.RESELLER_RESERVE_CAP_CENTS = "500";
  const capListing = publishForAccount(reseller, { ...base, productId: "cap-pan", priceCents: 10000 });
  if (capListing.status !== 200) throw new Error(capListing.error ?? "cap listing");
  const callsBeforeCap = calls.length;
  const capped = await payoutOrder("cap-pan", "cs_cap", "ch_cap");
  const capReserve = db.prepare("SELECT amount_cents FROM ledger WHERE order_id = ? AND party = 'reserve'").get(capped.order.id) as {
    amount_cents: number;
  };
  assert(capReserve.amount_cents === 500, "the hold stops at the $5 test cap");
  const capTransfer = calls.slice(callsBeforeCap).find((call) => call.idempotency?.includes("-reseller-"));
  const capReseller = getOrder(capped.order.id)?.resellerAmountCents ?? 0;
  assert(capTransfer?.body.includes(`amount=${capReseller - 500}`), "the transfer is the payout minus the capped hold");
  const fullListing = publishForAccount(reseller, { ...base, productId: "full-pan", priceCents: 10000 });
  if (fullListing.status !== 200) throw new Error(fullListing.error ?? "full listing");
  const callsBeforeFull = calls.length;
  const full = await payoutOrder("full-pan", "cs_full", "ch_full");
  const fullReserve = db.prepare("SELECT id FROM ledger WHERE order_id = ? AND party = 'reserve'").get(full.order.id);
  assert(!fullReserve, "a reseller already at the cap is paid in full");
  const fullTransfer = calls.slice(callsBeforeFull).find((call) => call.idempotency?.includes("-reseller-"));
  const fullReseller = getOrder(full.order.id)?.resellerAmountCents ?? 0;
  assert(fullTransfer?.body.includes(`amount=${fullReseller}`), "the capped reseller transfer is the full payout");
  delete process.env.RESELLER_RESERVE_CAP_CENTS;
  clearBalances();

  const releaseListing = publishForAccount(reseller, { ...base, productId: "release-pan", priceCents: 1000 });
  if (releaseListing.status !== 200) throw new Error(releaseListing.error ?? "release listing");
  const releasable = await payoutOrder("release-pan", "cs_release", "ch_release");
  const heldAt = db.prepare("SELECT created_at, amount_cents FROM ledger WHERE order_id = ? AND party = 'reserve'").get(releasable.order.id) as {
    created_at: number;
    amount_cents: number;
  };
  const day = 24 * 60 * 60 * 1000;
  const tooSoon = await releaseReserves(heldAt.created_at + 120 * day - 1);
  const tooSoonRow = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(releasable.order.id) as {
    status: string;
  };
  assert(tooSoon.transferred === 0 && tooSoonRow.status === "pending", "reserve stays put before 120 days");
  await releaseReserves(heldAt.created_at + 120 * day);
  const releaseReason = db.prepare("SELECT reason, kind FROM ledger_transfers WHERE order_id = ? AND kind = 'reserve_release'").get(
    releasable.order.id,
  ) as { reason: string; kind: string };
  assert(releaseReason.reason === "reserve_release", "the release is logged with a reason");
  await releaseReserves(heldAt.created_at + 120 * day);
  const releaseCount = db.prepare("SELECT COUNT(*) AS total FROM ledger_transfers WHERE order_id = ? AND kind = 'reserve_release'").get(
    releasable.order.id,
  ) as { total: number };
  assert(Number(releaseCount.total) === 1, "replaying the release does not transfer again");

  const blockedListing = publishForAccount(reseller, { ...base, productId: "blocked-pan", priceCents: 1000 });
  if (blockedListing.status !== 200) throw new Error(blockedListing.error ?? "blocked listing");
  const disputedListing = publishForAccount(reseller, { ...base, productId: "held-dispute-pan", priceCents: 20000 });
  if (disputedListing.status !== 200) throw new Error(disputedListing.error ?? "held dispute listing");
  const blockedReserve = await payoutOrder("blocked-pan", "cs_blocked", "ch_blocked");
  const partialBefore = db.prepare("SELECT amount_cents - reversed_cents AS open FROM ledger WHERE order_id = ? AND party = 'reserve'").get(
    blockedReserve.order.id,
  ) as { open: number };
  db.prepare("UPDATE ledger SET created_at = ? WHERE order_id = ? AND party = 'reserve'").run(Date.now() - 200 * day, blockedReserve.order.id);
  await applyRefund({
    chargeId: "ch_blocked",
    paymentIntentId: "pi_cs_blocked",
    amountRefunded: 10,
    gross: blockedReserve.order.amountCents,
    eventKey: "evt_blocked_partial",
  });
  const partialLeft = db.prepare("SELECT amount_cents - reversed_cents AS open, status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(
    blockedReserve.order.id,
  ) as { open: number; status: string };
  assert(partialLeft.status === "pending" && partialLeft.open > 0 && partialLeft.open < partialBefore.open, "a partial refund leaves reserve");
  const refundedAt = db.prepare("SELECT refunded_at FROM orders WHERE id = ?").get(blockedReserve.order.id) as { refunded_at: number };
  const earlyPartial = await releaseReserves(Date.now());
  const partialStill = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(blockedReserve.order.id) as {
    status: string;
  };
  assert(earlyPartial.transferred === 0 && partialStill.status === "pending", "reserve waits from the refund, not the old hold");
  await releaseReserves(refundedAt.refunded_at + 120 * day - 1);
  const partialAlmost = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(blockedReserve.order.id) as {
    status: string;
  };
  assert(partialAlmost.status === "pending", "leftover reserve stays until 120 days after the refund");
  await releaseReserves(refundedAt.refunded_at + 120 * day);
  const partialReleased = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(blockedReserve.order.id) as {
    status: string;
  };
  const partialReleaseCount = db.prepare("SELECT COUNT(*) AS total FROM ledger_transfers WHERE order_id = ? AND kind = 'reserve_release'").get(
    blockedReserve.order.id,
  ) as { total: number };
  assert(partialReleased.status === "transferred" && Number(partialReleaseCount.total) === 1, "leftover reserve releases once after the refund window");

  const disputedReserve = await payoutOrder("held-dispute-pan", "cs_held_dispute", "ch_held_dispute");
  db.prepare("UPDATE ledger SET created_at = ? WHERE order_id = ? AND party = 'reserve'").run(Date.now() - 200 * day, disputedReserve.order.id);
  await applyDisputeOpened({
    chargeId: "ch_held_dispute",
    paymentIntentId: "pi_cs_held_dispute",
    amount: 10,
    disputeId: "dp_held",
  });
  const duringDispute = db.prepare("SELECT amount_cents - reversed_cents AS open, status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(
    disputedReserve.order.id,
  ) as { open: number; status: string };
  assert(duringDispute.status === "pending" && duringDispute.open > 0, "an open dispute leaves reserve on the books");
  await releaseReserves(Date.now() + 400 * day);
  const disputeStill = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(disputedReserve.order.id) as {
    status: string;
  };
  assert(disputeStill.status === "pending", "an open dispute does not release reserve");
  const heldDuring = resellerReserveHeldCents(reseller.id);
  await applyDisputeClosed({
    chargeId: "ch_held_dispute",
    paymentIntentId: "pi_cs_held_dispute",
    status: "won",
    disputeId: "dp_held",
    amount: 10,
  });
  const restored = db.prepare("SELECT amount_cents - reversed_cents AS open, status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(
    disputedReserve.order.id,
  ) as { open: number; status: string };
  assert(restored.status === "pending" && restored.open >= duringDispute.open, "a won dispute puts the reserve back");
  const closedAt = db.prepare("SELECT dispute_closed_at FROM orders WHERE id = ?").get(disputedReserve.order.id) as {
    dispute_closed_at: number;
  };
  await releaseReserves(closedAt.dispute_closed_at + 120 * day - 1);
  const restoredStill = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(disputedReserve.order.id) as {
    status: string;
  };
  assert(restoredStill.status === "pending", "restored reserve waits 120 days after the dispute closes");
  await releaseReserves(closedAt.dispute_closed_at + 120 * day);
  const restoredDone = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(disputedReserve.order.id) as {
    status: string;
  };
  assert(restoredDone.status === "transferred", "restored reserve releases after the dispute window");
  assert(resellerReserveHeldCents(reseller.id) < heldDuring, "a released reserve no longer counts toward the cap");

  clearBalances();
  process.env.RESELLER_RESERVE_CAP_CENTS = "400";
  const retryListing = publishForAccount(reseller, { ...base, productId: "retry-pan", priceCents: 10000 });
  if (retryListing.status !== 200) throw new Error(retryListing.error ?? "retry listing");
  db.prepare("UPDATE connected_accounts SET payouts_enabled = 0, transfers_status = 'disabled' WHERE stripe_account_id = 'acct_fee_reseller'").run();
  try {
    const callsBeforeRetry = calls.length;
    const retried = await payoutOrder("retry-pan", "cs_retry", "ch_retry");
    const savedHold = db.prepare("SELECT amount_cents, status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(retried.order.id) as {
      amount_cents: number;
      status: string;
    };
    const retryReseller = getOrder(retried.order.id)?.resellerAmountCents ?? 0;
    assert(savedHold.amount_cents === 400 && savedHold.status === "pending", "the reserve is saved before the transfer");
    assert(
      !calls.slice(callsBeforeRetry).some((call) => call.idempotency?.includes("-reseller-")),
      "a payout does not transfer while Connect is disabled",
    );
    db.prepare("UPDATE connected_accounts SET payouts_enabled = 1, transfers_status = 'active' WHERE stripe_account_id = 'acct_fee_reseller'").run();
    const callsBeforeSecond = calls.length;
    await releaseTransfers(retried.order.id);
    const secondTransfer = calls.slice(callsBeforeSecond).find((call) => call.idempotency?.includes("-reseller-"));
    assert(
      secondTransfer?.body.includes(`amount=${retryReseller - savedHold.amount_cents}`),
      "a retry pays the payout minus the saved reserve",
    );
    const callsBeforeThird = calls.length;
    await releaseTransfers(retried.order.id);
    assert(
      !calls.slice(callsBeforeThird).some((call) => call.idempotency?.includes("-reseller-")),
      "a second retry does not pay the reseller again",
    );
    db.prepare("UPDATE ledger SET created_at = ? WHERE order_id = ? AND party = 'reserve'").run(Date.now() - 121 * day, retried.order.id);
    await releaseReserves(Date.now());
    const retryRelease = calls.filter((call) => call.idempotency?.startsWith(`reserve-release-${retried.order.id}-`));
    assert(retryRelease.length === 1 && retryRelease[0]?.body.includes("amount=400"), "the saved reserve is released once");
    const amountOf = (body: string | undefined) => Number(body?.match(/amount=(\d+)/)?.[1] ?? 0);
    assert(
      amountOf(secondTransfer?.body) + amountOf(retryRelease[0]?.body) === retryReseller,
      "the reserve is not paid twice",
    );
  } finally {
    delete process.env.RESELLER_RESERVE_CAP_CENTS;
    db.prepare("UPDATE connected_accounts SET payouts_enabled = 1, transfers_status = 'active' WHERE stripe_account_id = 'acct_fee_reseller'").run();
  }

  clearBalances();
  const stuckListing = publishForAccount(reseller, { ...base, productId: "stuck-pan", priceCents: 1000 });
  if (stuckListing.status !== 200) throw new Error(stuckListing.error ?? "stuck listing");
  const stuck = await payoutOrder("stuck-pan", "cs_stuck", "ch_stuck");
  db.prepare("UPDATE ledger SET created_at = ? WHERE order_id = ? AND party = 'reserve'").run(Date.now() - 121 * day, stuck.order.id);
  db.prepare("UPDATE connected_accounts SET payouts_enabled = 0, transfers_status = 'disabled' WHERE stripe_account_id = 'acct_fee_reseller'").run();
  const logged: string[] = [];
  const writeError = console.error;
  console.error = (...args: unknown[]) => {
    logged.push(args.map(String).join(" "));
  };
  try {
    await releaseReserves(Date.now());
    await releaseReserves(Date.now());
  } finally {
    console.error = writeError;
    db.prepare("UPDATE connected_accounts SET payouts_enabled = 1, transfers_status = 'active' WHERE stripe_account_id = 'acct_fee_reseller'").run();
  }
  const stuckRow = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(stuck.order.id) as { status: string };
  const stuckFlag = db.prepare("SELECT reserve_release_flag FROM orders WHERE id = ?").get(stuck.order.id) as {
    reserve_release_flag: string | null;
  };
  assert(stuckRow.status === "pending" && stuckFlag.reserve_release_flag === "connect", "a disabled Connect account flags the reserve");
  assert(
    logged.filter((line) => line.includes(stuck.order.id) && line.includes("cannot receive a transfer")).length === 1,
    "the blocked reserve is logged once",
  );
  assert(
    listHoldAlerts().some((alert) => alert.id === stuck.order.id && alert.kind === "reserve"),
    "admins see a reserve the sweep could not release",
  );
  await releaseReserves(Date.now());
  const stuckAfter = db.prepare("SELECT status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(stuck.order.id) as {
    status: string;
  };
  const flagAfter = db.prepare("SELECT reserve_release_flag FROM orders WHERE id = ?").get(stuck.order.id) as {
    reserve_release_flag: string | null;
  };
  assert(stuckAfter.status === "transferred" && flagAfter.reserve_release_flag == null, "the reserve releases once Connect can receive it");
  assert(
    !listHoldAlerts().some((alert) => alert.id === stuck.order.id && alert.kind === "reserve"),
    "the admin flag clears after the reserve releases",
  );

  clearBalances();
  const recoveryListing = publishForAccount(reseller, { ...base, productId: "recovery-pan", priceCents: 10000 });
  if (recoveryListing.status !== 200) throw new Error(recoveryListing.error ?? "recovery listing");
  const recovery = await payoutOrder("recovery-pan", "cs_recovery", "ch_recovery");
  const pendingListing = publishForAccount(reseller, { ...base, productId: "pending-pan", priceCents: 1000 });
  if (pendingListing.status !== 200) throw new Error(pendingListing.error ?? "pending listing");
  const future = createPendingOrder({ productId: "pending-pan", qty: 1, ship });
  if ("error" in future) throw new Error(future.error);
  const futurePay = await settleCheckoutSession({
    id: "cs_future",
    url: null,
    status: "complete",
    payment_status: "paid",
    customer: null,
    subscription: null,
    amount_total: future.order.amountCents,
    metadata: { kind: "order", order_id: future.order.id, account_id: future.order.accountId },
    payment_intent: {
      id: "pi_future",
      latest_charge: { id: "ch_future", outcome: { risk_level: "normal", type: "authorized" } },
    },
  });
  if ("error" in futurePay) throw new Error(futurePay.error);
  const reserveBefore = db.prepare("SELECT amount_cents - reversed_cents AS open FROM ledger WHERE order_id = ? AND party = 'reserve'").get(
    recovery.order.id,
  ) as { open: number };
  const futureBefore = db.prepare("SELECT reversed_cents FROM ledger WHERE order_id = ? AND party = 'reseller'").get(future.order.id) as {
    reversed_cents: number;
  };
  await applyRefund({
    chargeId: "ch_recovery",
    paymentIntentId: "pi_cs_recovery",
    amountRefunded: recovery.order.amountCents,
    gross: recovery.order.amountCents,
    eventKey: "evt_recovery",
  });
  const reserveAfter = db.prepare("SELECT amount_cents - reversed_cents AS open, status FROM ledger WHERE order_id = ? AND party = 'reserve'").get(
    recovery.order.id,
  ) as { open: number; status: string };
  const futureAfter = db.prepare("SELECT reversed_cents, amount_cents FROM ledger WHERE order_id = ? AND party = 'reseller'").get(
    future.order.id,
  ) as { reversed_cents: number; amount_cents: number };
  assert(reserveBefore.open > 0 && reserveAfter.open < reserveBefore.open, "recovery spends reserve first");
  assert(futureAfter.reversed_cents > futureBefore.reversed_cents, "recovery then uses a pending payout");
  const recoveryDebt = db.prepare(
    "SELECT COALESCE(SUM(amount_cents - reversed_cents), 0) AS debt FROM ledger WHERE order_id = ? AND (party = 'reseller_debt' OR party LIKE 'reseller_debt:%')",
  ).get(recovery.order.id) as { debt: number };
  const recoveryReseller = getOrder(recovery.order.id);
  const feeDebt = (recoveryReseller?.platformFeeCents ?? 0) + (recoveryReseller?.stripeFeeCents ?? 0);
  assert(Number(recoveryDebt.debt) < feeDebt, "the pending payout reduces what becomes debt");
  assert(Number(recoveryDebt.debt) > 0, "the uncovered remainder is still debt");
  const recoveryScreen = resellerReserveSummary(reseller.id);
  assert(recoveryScreen.heldCents >= 0 && recoveryScreen.days === 120, "the payout screen can read the reserve");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
