import { randomUUID } from "node:crypto";
import { MEMBER_PRICE } from "../account";
import {
  BUYER_WINDOW_MS,
  disputeClawback,
  holdState,
  platformFeeBps,
  refundClawback,
  splitWithStripeFee,
  stripeDisputeFeeCents,
  type Split,
} from "./fees";
import { markMember } from "./accounts";
import { connectReady, getConnected } from "./connect";
import { changed, getDb } from "./db";
import { fulfillPaidOrder, getOrder, orderByReceiptToken, type StoreOrder } from "./store";
import {
  createTransfer,
  readPaidCharge,
  retrievePaymentIntent,
  reverseTransfer,
  type StripeSession,
} from "./stripe";

export type LedgerParty = "reseller" | "supplier";
export type LedgerStatus = "pending" | "transferred" | "reversed" | "canceled";

type LedgerRow = {
  id: string;
  order_id: string;
  party: LedgerParty;
  account_id: string;
  amount_cents: number;
  status: LedgerStatus;
  transfer_id: string | null;
  reversed_cents: number;
  reversal_reason: string | null;
};

function isParty(value: string): value is LedgerParty {
  switch (value) {
    case "reseller":
    case "supplier":
      return true;
    default:
      return false;
  }
}

function rowsFor(orderId: string) {
  return getDb().prepare("SELECT * FROM ledger WHERE order_id = ?").all(orderId) as LedgerRow[];
}

export function payoutHold(order: StoreOrder) {
  if (!order.paidAt) return null;
  if (order.disputeOpen) return "A dispute is open. Payouts stay frozen.";
  if (order.reviewOpen) return "Stripe Radar is reviewing this payment.";
  const hold = holdState(order.paidAt);
  if (hold === "expired") return "This payment is past Stripe's hold window. Refund it instead of transferring.";
  if (order.buyerDisputeOpen && !order.buyerDisputeResolved) {
    return "The buyer disputed this delivery. An admin has to review it before a payout.";
  }
  if (!order.deliveredAt) return "Payout waits until the order is delivered.";
  if (!order.shippedAt || !order.trackingNumber) return "Payout waits until the supplier adds a carrier and tracking number.";
  if (!order.buyerConfirmedAt && !order.buyerDisputeResolved && Date.now() < order.deliveredAt + BUYER_WINDOW_MS) {
    return "Payout waits until the buyer confirms receipt, or until 7 days after delivery with no dispute.";
  }
  if (order.reviewClosed && !order.riskApproved) {
    return "Radar closed a review. An admin has to approve the payout.";
  }
  if ((order.riskLevel === "elevated" || order.riskLevel === "highest") && !order.riskApproved) {
    return "Stripe flagged this payment. An admin has to approve the payout.";
  }
  if (!order.riskLevel && !order.riskApproved) return "Payout waits until Stripe reports the payment risk.";
  if (hold === "nearing") return "This payment is nearing Stripe's hold window.";
  return null;
}

function writePendingLedger(order: StoreOrder) {
  const parties: Array<{ party: LedgerParty; accountId: string | null; amount: number | null }> = [
    { party: "reseller", accountId: order.accountId, amount: order.resellerAmountCents },
    { party: "supplier", accountId: order.supplierAccountId, amount: order.supplierAmountCents },
  ];
  const insert = getDb().prepare(
    `INSERT INTO ledger (id, order_id, party, account_id, amount_cents, status, transfer_id, reversed_cents, reversal_reason)
     VALUES (?, ?, ?, ?, ?, 'pending', NULL, 0, NULL)
     ON CONFLICT(order_id, party) DO NOTHING`,
  );
  for (const party of parties) {
    if (!party.accountId || !party.amount || party.amount <= 0) continue;
    insert.run(randomUUID(), order.id, party.party, party.accountId, party.amount);
  }
}

async function rememberRisk(order: StoreOrder) {
  if (order.riskLevel || !order.paymentIntentId) return getOrder(order.id) ?? order;
  const intent = await retrievePaymentIntent(order.paymentIntentId);
  const charge = intent.latest_charge;
  const chargeId = typeof charge === "string" ? charge : charge?.id ?? order.chargeId;
  const riskLevel = typeof charge === "object" && charge ? charge.outcome?.risk_level ?? null : null;
  const riskType = typeof charge === "object" && charge ? charge.outcome?.type ?? null : null;
  getDb()
    .prepare(
      `UPDATE orders
       SET charge_id = COALESCE(charge_id, ?), risk_level = COALESCE(risk_level, ?), risk_type = COALESCE(risk_type, ?)
       WHERE id = ?`,
    )
    .run(chargeId, riskLevel, riskType, order.id);
  return getOrder(order.id) ?? order;
}

function blockReason(order: StoreOrder) {
  if (order.disputeOpen) return "dispute" as const;
  if (order.reviewOpen) return "review" as const;
  if (!order.deliveredAt) return "not_delivered" as const;
  if (holdState(order.paidAt) === "expired" || order.refundRequired) return "expired" as const;
  if (order.buyerDisputeOpen && !order.buyerDisputeResolved) return "buyer_dispute" as const;
  if (!order.buyerConfirmedAt && !order.buyerDisputeResolved && Date.now() < order.deliveredAt + BUYER_WINDOW_MS) {
    return "window" as const;
  }
  if (order.reviewClosed && !order.riskApproved) return "review_closed" as const;
  if ((order.riskLevel === "elevated" || order.riskLevel === "highest") && !order.riskApproved) return "risk" as const;
  if (!order.riskLevel && !order.riskApproved) return "risk_unknown" as const;
  if (!order.chargeId) return "no_charge" as const;
  return null;
}

function recordTransfer(
  row: { id: string; order_id: string; party: string },
  transferId: string,
  amountCents: number,
  kind: "transfer" | "restore" | "reversal" | "debt" | "debt_offset" | "credit",
  reason: string | null,
) {
  if (amountCents <= 0) return;
  getDb()
    .prepare(
      `INSERT INTO ledger_transfers (
         id, ledger_id, order_id, party, transfer_id, amount_cents, kind, reason, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), row.id, row.order_id, row.party, transferId, amountCents, kind, reason, Date.now());
}

export function resellerDebtCents(accountId: string) {
  const row = getDb()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents - reversed_cents), 0) AS debt
       FROM ledger
       WHERE account_id = ? AND party IN ('reseller_debt', 'dispute_debt') AND status = 'pending'`,
    )
    .get(accountId) as { debt: number | bigint } | undefined;
  return Number(row?.debt ?? 0);
}

function setDebt(
  orderId: string,
  accountId: string,
  party: "reseller_debt" | "dispute_debt",
  amount: number,
  reason: string,
) {
  if (amount <= 0) return;
  const existing = getDb().prepare("SELECT * FROM ledger WHERE order_id = ? AND party = ?").get(orderId, party) as
    | LedgerRow
    | undefined;
  if (!existing) {
    const id = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO ledger (id, order_id, party, account_id, amount_cents, status, transfer_id, reversed_cents, reversal_reason)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL, 0, ?)`,
      )
      .run(id, orderId, party, accountId, amount, reason);
    recordTransfer({ id, order_id: orderId, party }, `debt-${id}-${amount}`, amount, "debt", reason);
    return;
  }
  if (amount <= existing.amount_cents) return;
  const delta = amount - existing.amount_cents;
  getDb()
    .prepare("UPDATE ledger SET amount_cents = ?, status = 'pending', reversal_reason = ? WHERE id = ?")
    .run(amount, reason, existing.id);
  recordTransfer(existing, `debt-${existing.id}-${amount}`, delta, "debt", reason);
}

function collectDebt(accountId: string, available: number, source: LedgerRow) {
  if (available <= 0) return 0;
  let left = available;
  const debts = getDb()
    .prepare(
      `SELECT * FROM ledger
       WHERE account_id = ? AND party IN ('reseller_debt', 'dispute_debt') AND status = 'pending'
       ORDER BY rowid`,
    )
    .all(accountId) as LedgerRow[];
  let taken = 0;
  for (const debt of debts) {
    if (left <= 0) break;
    const open = debt.amount_cents - debt.reversed_cents;
    if (open <= 0) continue;
    const bite = Math.min(open, left);
    const reversed = debt.reversed_cents + bite;
    const status: LedgerStatus = reversed >= debt.amount_cents ? "reversed" : "pending";
    getDb().prepare("UPDATE ledger SET reversed_cents = ?, status = ? WHERE id = ?").run(reversed, status, debt.id);
    recordTransfer(
      { id: source.id, order_id: source.order_id, party: source.party },
      `offset-${source.id}-${debt.id}-${reversed}`,
      bite,
      "debt_offset",
      "debt_offset",
    );
    left -= bite;
    taken += bite;
  }
  return taken;
}

export async function releaseTransfers(orderId: string) {
  let order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.paidAt) order = await rememberRisk(order);
  const blocked = blockReason(order);
  switch (blocked) {
    case null:
      break;
    case "dispute":
    case "review":
    case "not_delivered":
    case "expired":
    case "buyer_dispute":
    case "window":
    case "review_closed":
    case "risk":
    case "risk_unknown":
    case "no_charge":
      return { transferred: 0, blocked };
    default: {
      const _never: never = blocked;
      return { transferred: 0, blocked: _never };
    }
  }
  let transferred = 0;
  for (const row of rowsFor(orderId)) {
    if (!isParty(row.party) || row.status !== "pending") continue;
    let remaining = row.amount_cents - row.reversed_cents;
    if (row.party === "reseller" && remaining > 0) {
      const offset = collectDebt(row.account_id, remaining, row);
      if (offset > 0) {
        const reversed = row.reversed_cents + offset;
        getDb()
          .prepare("UPDATE ledger SET reversed_cents = ?, reversal_reason = 'debt_offset' WHERE id = ?")
          .run(reversed, row.id);
        row.reversed_cents = reversed;
        remaining -= offset;
      }
    }
    if (remaining <= 0) {
      getDb().prepare("UPDATE ledger SET status = 'canceled' WHERE id = ? AND status = 'pending'").run(row.id);
      continue;
    }
    const connected = getConnected(row.account_id);
    if (!connectReady(connected) || !connected) {
      return { transferred, blocked: "connect" as const, error: "A payout account is not ready." as const };
    }
    const transfer = await createTransfer({
      amountCents: remaining,
      destination: connected.stripeAccountId,
      chargeId: order.chargeId!,
      transferGroup: order.transferGroup || `order_${order.id}`,
      idempotencyKey: `transfer-${order.id}-${row.party}-${remaining}`,
      orderId: order.id,
      party: row.party,
      accountId: row.account_id,
    });
    if (!transfer.id) throw new Error("Stripe did not return a transfer id.");
    const saved = changed(
      getDb()
        .prepare("UPDATE ledger SET status = 'transferred', transfer_id = ? WHERE id = ? AND status = 'pending'")
        .run(transfer.id, row.id),
    );
    if (saved === 1) {
      recordTransfer(row, transfer.id, remaining, "transfer", null);
      transferred += 1;
    }
  }
  return { transferred, blocked: null };
}

export async function settleCheckoutSession(session: StripeSession) {
  const kind = session.metadata?.kind;
  if (kind === "membership") {
    const settled =
      session.payment_status === "paid" || session.payment_status === "no_payment_required";
    if (!settled) return { error: "Payment is not complete." as const };
    const accountId = session.metadata.account_id;
    if (!accountId) return { error: "Checkout is missing the account." as const };
    const trial = session.amount_total === 0;
    if (!trial && session.amount_total !== MEMBER_PRICE * 100) {
      return { error: "The paid amount does not match membership." as const };
    }
    const customer = typeof session.customer === "string" ? session.customer : null;
    const subscription = typeof session.subscription === "string" ? session.subscription : null;
    markMember(accountId, customer, subscription, trial ? "trialing" : "active");
    return { kind: "membership" as const };
  }
  if (session.payment_status !== "paid") return { error: "Payment is not complete." as const };
  if (kind === "order") {
    const orderId = session.metadata.order_id;
    if (!orderId) return { error: "Checkout is missing the order." as const };
    const current = getOrder(orderId);
    if (!current) return { error: "That order is not on file." as const };
    if (session.amount_total !== current.amountCents) {
      return { error: "The paid amount does not match this order." as const };
    }
    const charge = readPaidCharge(session);
    const priced = actualResellerShare(current, charge.stripeFeeCents);
    getDb()
      .prepare(
        `UPDATE orders
         SET status = 'paid',
             stripe_session_id = COALESCE(stripe_session_id, ?),
             payment_intent_id = COALESCE(payment_intent_id, ?),
             charge_id = COALESCE(charge_id, ?),
             transfer_group = COALESCE(transfer_group, ?),
             risk_level = COALESCE(risk_level, ?),
             risk_type = COALESCE(risk_type, ?),
             paid_at = COALESCE(paid_at, ?),
             stripe_fee_cents = ?,
             reseller_amount_cents = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(
        session.id,
        charge.paymentIntentId,
        charge.chargeId,
        current.transferGroup || `order_${current.id}`,
        charge.riskLevel,
        charge.riskType,
        Date.now(),
        priced.stripeFeeCents,
        priced.resellerAmountCents,
        orderId,
      );
    if (priced.shortfallCents > 0) {
      setDebt(orderId, current.accountId, "reseller_debt", priced.shortfallCents, "stripe_fee");
    }
    const paid = getOrder(orderId);
    if (!paid || paid.status === "pending") return { error: "Payment is not complete." as const };
    writePendingLedger(paid);
    const order = await fulfillPaidOrder(orderId);
    return { kind: "order" as const, order };
  }
  return { error: "Checkout did not say what it was paying for." as const };
}

export async function markDelivered(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.status === "pending") return { error: "This order is not paid." as const };
  if (!order.carrier || !order.trackingNumber) {
    return { error: "Add a carrier and tracking number before marking this delivered." as const };
  }
  getDb().prepare("UPDATE orders SET delivered_at = COALESCE(delivered_at, ?) WHERE id = ?").run(Date.now(), orderId);
  return { order: getOrder(orderId), released: { transferred: 0, blocked: "window" as const } };
}

export async function approvePayout(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.status === "pending") return { error: "This order is not paid." as const };
  getDb()
    .prepare(
      `UPDATE orders
       SET risk_approved = 1,
           buyer_dispute_resolved = CASE WHEN buyer_dispute_open = 1 THEN 1 ELSE buyer_dispute_resolved END
       WHERE id = ?`,
    )
    .run(orderId);
  const released = await releaseTransfers(orderId);
  return { order: getOrder(orderId), released };
}

function actualResellerShare(order: StoreOrder, actualFee: number | null) {
  const estimate = order.stripeFeeCents ?? order.stripeFeeEstCents ?? 0;
  if (
    actualFee == null ||
    order.platformFeeCents == null ||
    order.supplierAmountCents == null ||
    order.resellerAmountCents == null
  ) {
    return { stripeFeeCents: estimate, resellerAmountCents: order.resellerAmountCents ?? 0, shortfallCents: 0 };
  }
  const current: Split = {
    grossCents: order.amountCents,
    feeBps: order.feeBps ?? platformFeeBps(),
    platformFeeCents: order.platformFeeCents,
    stripeFeeCents: estimate,
    supplierAmountCents: order.supplierAmountCents,
    resellerAmountCents: order.resellerAmountCents,
  };
  const next = splitWithStripeFee(current, actualFee);
  if (next.resellerAmountCents < 0) {
    return { stripeFeeCents: next.stripeFeeCents, resellerAmountCents: 0, shortfallCents: -next.resellerAmountCents };
  }
  return { stripeFeeCents: next.stripeFeeCents, resellerAmountCents: next.resellerAmountCents, shortfallCents: 0 };
}

function disputeHoldReason(reason: string | null) {
  switch (reason) {
    case "dispute":
    case "dispute_fee":
    case "dispute_amount":
      return true;
    default:
      return false;
  }
}

async function applyTarget(row: LedgerRow, target: number, reason: string, eventKey: string) {
  const capped = Math.min(row.amount_cents, Math.max(0, target));
  const next = Math.max(row.reversed_cents, capped);
  const delta = next - row.reversed_cents;
  if (delta <= 0) return;
  if (row.status === "pending" || (row.status === "canceled" && !row.transfer_id)) {
    const status: LedgerStatus = next >= row.amount_cents ? "canceled" : "pending";
    getDb()
      .prepare("UPDATE ledger SET reversed_cents = ?, status = ?, reversal_reason = ? WHERE id = ?")
      .run(next, status, reason, row.id);
    recordTransfer(row, `reversal-pending-${row.id}-${eventKey}-${delta}`, delta, "reversal", reason);
    return;
  }
  if ((row.status === "transferred" || row.status === "reversed") && row.transfer_id) {
    await reverseTransfer({
      transferId: row.transfer_id,
      amountCents: delta,
      idempotencyKey: `reversal-${row.transfer_id}-${eventKey}-${delta}`,
    });
    const status: LedgerStatus = next >= row.amount_cents ? "reversed" : "transferred";
    getDb()
      .prepare("UPDATE ledger SET reversed_cents = ?, status = ?, reversal_reason = ? WHERE id = ?")
      .run(next, status, reason, row.id);
    recordTransfer(row, `reversal-${row.transfer_id}-${eventKey}-${delta}`, delta, "reversal", reason);
  }
}

async function holdForClawback(
  order: StoreOrder,
  claw: { supplierReverseCents: number; resellerReverseCents: number },
  supplierReason: string,
  resellerReason: string,
  eventKey: string,
) {
  for (const row of rowsFor(order.id)) {
    if (!isParty(row.party)) continue;
    const target = row.party === "supplier" ? claw.supplierReverseCents : claw.resellerReverseCents;
    const reason = row.party === "supplier" ? supplierReason : resellerReason;
    await applyTarget(row, target, reason, eventKey);
  }
}

export async function applyRefund(input: {
  chargeId: string | null;
  paymentIntentId: string | null;
  amountRefunded: number;
  gross: number;
  eventKey: string;
}) {
  const order = findOrder(input.chargeId, input.paymentIntentId);
  if (!order || input.gross <= 0) return;
  const claw = refundClawback({
    grossCents: input.gross,
    refundedCents: input.amountRefunded,
    platformFeeCents: order.platformFeeCents ?? 0,
    stripeFeeCents: order.stripeFeeCents ?? order.stripeFeeEstCents ?? 0,
    supplierAmountCents: order.supplierAmountCents ?? 0,
    resellerAmountCents: order.resellerAmountCents ?? 0,
  });
  await holdForClawback(order, claw, "refund", "refund_fee", input.eventKey);
  setDebt(order.id, order.accountId, "reseller_debt", claw.debtCents, "refund_fee");
}

export async function applyDisputeOpened(input: {
  chargeId: string | null;
  paymentIntentId: string | null;
  amount: number;
  disputeId: string;
}) {
  const order = findOrder(input.chargeId, input.paymentIntentId);
  if (!order) return;
  getDb().prepare("UPDATE orders SET dispute_open = 1 WHERE id = ?").run(order.id);
  await holdDispute(order, input.amount, input.disputeId);
}

async function holdDispute(order: StoreOrder, disputedCents: number, disputeId: string) {
  const claw = disputeClawback({
    grossCents: order.amountCents,
    disputedCents,
    platformFeeCents: order.platformFeeCents ?? 0,
    stripeFeeCents: order.stripeFeeCents ?? order.stripeFeeEstCents ?? 0,
    supplierAmountCents: order.supplierAmountCents ?? 0,
    resellerAmountCents: order.resellerAmountCents ?? 0,
    disputeFeeCents: stripeDisputeFeeCents(),
  });
  const resellerReason = claw.feeRecoveredCents > 0 ? "dispute_fee" : "dispute_amount";
  await holdForClawback(order, claw, "dispute_amount", resellerReason, disputeId);
  setDebt(order.id, order.accountId, "dispute_debt", claw.debtCents, "dispute_fee");
}

async function forgiveDisputeDebt(order: StoreOrder, disputeId: string) {
  const row = getDb().prepare("SELECT * FROM ledger WHERE order_id = ? AND party = 'dispute_debt'").get(order.id) as
    | LedgerRow
    | undefined;
  if (!row) return;
  const open = row.amount_cents - row.reversed_cents;
  const feeCredit = Math.min(stripeDisputeFeeCents(), open);
  const amountCredit = open - feeCredit;
  recordTransfer(row, `credit-${row.id}-${disputeId}-fee-${feeCredit}`, feeCredit, "credit", "dispute_fee");
  recordTransfer(row, `credit-${row.id}-${disputeId}-amount-${amountCredit}`, amountCredit, "credit", "dispute_amount");
  if (row.reversed_cents > 0) {
    const connected = getConnected(row.account_id);
    const current = getOrder(order.id);
    if (connectReady(connected) && connected && current?.chargeId) {
      const transfer = await createTransfer({
        amountCents: row.reversed_cents,
        destination: connected.stripeAccountId,
        chargeId: current.chargeId,
        transferGroup: current.transferGroup || `order_${current.id}`,
        idempotencyKey: `dispute-credit-${current.id}-${disputeId}-${row.reversed_cents}`,
        orderId: current.id,
        party: "reseller",
        accountId: row.account_id,
      });
      if (transfer.id) recordTransfer(row, transfer.id, row.reversed_cents, "credit", "dispute_fee");
    }
  }
  getDb()
    .prepare("UPDATE ledger SET amount_cents = 0, reversed_cents = 0, status = 'reversed', reversal_reason = 'dispute_fee' WHERE id = ?")
    .run(row.id);
}

export async function applyDisputeClosed(input: {
  chargeId: string | null;
  paymentIntentId: string | null;
  status: string;
  disputeId: string;
  amount?: number;
}) {
  const order = findOrder(input.chargeId, input.paymentIntentId);
  if (!order) return;
  getDb().prepare("UPDATE orders SET dispute_open = 0 WHERE id = ?").run(order.id);
  if (!disputeKeepsFunds(input.status)) {
    if (input.amount && input.amount > 0) await holdDispute(order, input.amount, input.disputeId);
    return;
  }
  await forgiveDisputeDebt(order, input.disputeId);
  for (const row of rowsFor(order.id)) {
    if (!disputeHoldReason(row.reversal_reason) || row.reversed_cents <= 0) continue;
    if (!row.transfer_id) {
      getDb()
        .prepare("UPDATE ledger SET status = 'pending', reversed_cents = 0, reversal_reason = NULL WHERE id = ?")
        .run(row.id);
      continue;
    }
    const connected = getConnected(row.account_id);
    const current = getOrder(order.id);
    if (!connectReady(connected) || !connected || !current?.chargeId) continue;
    const transfer = await createTransfer({
      amountCents: row.reversed_cents,
      destination: connected.stripeAccountId,
      chargeId: current.chargeId,
      transferGroup: current.transferGroup || `order_${current.id}`,
      idempotencyKey: `restore-${current.id}-${row.party}-${input.disputeId}-${row.reversed_cents}`,
      orderId: current.id,
      party: row.party,
      accountId: row.account_id,
    });
    if (!transfer.id) throw new Error("Stripe did not return a transfer id.");
    recordTransfer(row, transfer.id, row.reversed_cents, "restore", "dispute_amount");
    getDb()
      .prepare(
        "UPDATE ledger SET status = 'transferred', transfer_id = ?, reversed_cents = 0, reversal_reason = NULL WHERE id = ?",
      )
      .run(transfer.id, row.id);
  }
  if (getOrder(order.id)?.deliveredAt) await releaseTransfers(order.id);
}

function disputeKeepsFunds(status: string) {
  switch (status) {
    case "won":
    case "warning_closed":
    case "prevented":
      return true;
    case "lost":
    case "warning_needs_response":
    case "warning_under_review":
    case "needs_response":
    case "under_review":
      return false;
    default:
      return false;
  }
}

function findOrder(chargeId: string | null, paymentIntentId: string | null) {
  if (chargeId) {
    const row = getDb().prepare("SELECT id FROM orders WHERE charge_id = ?").get(chargeId) as { id: string } | undefined;
    if (row) return getOrder(row.id);
  }
  if (paymentIntentId) {
    const row = getDb().prepare("SELECT id FROM orders WHERE payment_intent_id = ?").get(paymentIntentId) as
      | { id: string }
      | undefined;
    if (row) return getOrder(row.id);
  }
  return null;
}

export async function confirmReceipt(token: string) {
  const order = orderByReceiptToken(token);
  if (!order) return { error: "That receipt link does not match an order." as const };
  if (!order.deliveredAt) return { error: "This order is not marked delivered yet." as const };
  if (order.buyerDisputeOpen && !order.buyerDisputeResolved) {
    return { error: "This delivery is in dispute. An operator has to review it." as const };
  }
  getDb()
    .prepare("UPDATE orders SET buyer_confirmed_at = COALESCE(buyer_confirmed_at, ?) WHERE id = ?")
    .run(Date.now(), order.id);
  const released = await releaseTransfers(order.id);
  return { order: getOrder(order.id), released };
}

export async function disputeReceipt(token: string, note: string) {
  const order = orderByReceiptToken(token);
  if (!order) return { error: "That receipt link does not match an order." as const };
  if (!order.deliveredAt) return { error: "You can dispute a delivery after it is marked delivered." as const };
  if (order.buyerConfirmedAt) return { error: "This order was already confirmed." as const };
  if (Date.now() > order.deliveredAt + BUYER_WINDOW_MS) {
    return { error: "The 7-day window for this delivery has closed." as const };
  }
  const text = note.trim();
  if (text.length < 4 || text.length > 500) return { error: "Write a short note about the problem." as const };
  getDb()
    .prepare(
      `UPDATE orders
       SET buyer_dispute_open = 1, buyer_dispute_resolved = 0, buyer_dispute_note = ?
       WHERE id = ?`,
    )
    .run(text, order.id);
  return { order: getOrder(order.id) };
}

export async function releaseMatured(now = Date.now()) {
  const cutoff = now - BUYER_WINDOW_MS;
  const rows = getDb()
    .prepare(
      `SELECT id FROM orders
       WHERE delivered_at IS NOT NULL
         AND delivered_at <= ?
         AND buyer_confirmed_at IS NULL
         AND buyer_dispute_open = 0`,
    )
    .all(cutoff) as { id: string }[];
  let transferred = 0;
  for (const row of rows) {
    try {
      const result = await releaseTransfers(row.id);
      transferred += result.transferred ?? 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Matured payout did not transfer.";
      console.error(message);
    }
  }
  return { transferred };
}

export function setReview(chargeId: string | null, paymentIntentId: string | null, open: boolean) {
  const order = findOrder(chargeId, paymentIntentId);
  if (!order) return;
  if (open) {
    getDb().prepare("UPDATE orders SET review_open = 1, review_closed = 0 WHERE id = ?").run(order.id);
    return;
  }
  getDb().prepare("UPDATE orders SET review_open = 0, review_closed = 1 WHERE id = ?").run(order.id);
}
