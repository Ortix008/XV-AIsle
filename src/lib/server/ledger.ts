import { randomUUID } from "node:crypto";
import { MEMBER_PRICE } from "../account";
import { holdState } from "./fees";
import { markMember } from "./accounts";
import { connectReady, getConnected } from "./connect";
import { changed, getDb } from "./db";
import { fulfillPaidOrder, getOrder, type StoreOrder } from "./store";
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
  if (!order.deliveredAt) return "Payout waits until the order is delivered.";
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
  if (holdState(order.paidAt) === "expired") return "expired" as const;
  if (order.reviewClosed && !order.riskApproved) return "review_closed" as const;
  if ((order.riskLevel === "elevated" || order.riskLevel === "highest") && !order.riskApproved) return "risk" as const;
  if (!order.riskLevel && !order.riskApproved) return "risk_unknown" as const;
  if (!order.chargeId) return "no_charge" as const;
  return null;
}

export async function releaseTransfers(orderId: string) {
  let order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.paidAt) order = await rememberRisk(order);
  const blocked = blockReason(order);
  if (blocked === "not_delivered" || blocked === "dispute" || blocked === "review" || blocked === "expired") {
    return { transferred: 0, blocked };
  }
  if (blocked === "review_closed" || blocked === "risk" || blocked === "risk_unknown" || blocked === "no_charge") {
    return { transferred: 0, blocked };
  }
  if (blocked) {
    const _never: never = blocked;
    return { transferred: 0, blocked: _never };
  }
  let transferred = 0;
  for (const row of rowsFor(orderId)) {
    if (!isParty(row.party) || row.status !== "pending") continue;
    const remaining = row.amount_cents - row.reversed_cents;
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
      idempotencyKey: `transfer-${order.id}-${row.party}`,
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
    if (saved === 1) transferred += 1;
  }
  return { transferred, blocked: null };
}

export async function settleCheckoutSession(session: StripeSession) {
  if (session.payment_status !== "paid") return { error: "Payment is not complete." as const };
  const kind = session.metadata?.kind;
  if (kind === "membership") {
    const accountId = session.metadata.account_id;
    if (!accountId) return { error: "Checkout is missing the account." as const };
    if (session.amount_total !== MEMBER_PRICE * 100) {
      return { error: "The paid amount does not match membership." as const };
    }
    const customer = typeof session.customer === "string" ? session.customer : null;
    const subscription = typeof session.subscription === "string" ? session.subscription : null;
    markMember(accountId, customer, subscription);
    return { kind: "membership" as const };
  }
  if (kind === "order") {
    const orderId = session.metadata.order_id;
    if (!orderId) return { error: "Checkout is missing the order." as const };
    const current = getOrder(orderId);
    if (!current) return { error: "That order is not on file." as const };
    if (session.amount_total !== current.amountCents) {
      return { error: "The paid amount does not match this order." as const };
    }
    const charge = readPaidCharge(session);
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
             paid_at = COALESCE(paid_at, ?)
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
        orderId,
      );
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
  getDb().prepare("UPDATE orders SET delivered_at = COALESCE(delivered_at, ?) WHERE id = ?").run(Date.now(), orderId);
  const released = await releaseTransfers(orderId);
  return { order: getOrder(orderId), released };
}

export async function approvePayout(orderId: string) {
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.status === "pending") return { error: "This order is not paid." as const };
  getDb().prepare("UPDATE orders SET risk_approved = 1 WHERE id = ?").run(orderId);
  const released = await releaseTransfers(orderId);
  return { order: getOrder(orderId), released };
}

function share(amount: number, refunded: number, gross: number) {
  if (gross <= 0 || refunded <= 0) return 0;
  if (refunded >= gross) return amount;
  return Math.min(amount, Math.round((amount * refunded) / gross));
}

async function reverseTransferred(row: LedgerRow, targetReverse: number, reason: string, eventKey: string) {
  const delta = targetReverse - row.reversed_cents;
  if (delta <= 0 || !row.transfer_id) return;
  await reverseTransfer({
    transferId: row.transfer_id,
    amountCents: delta,
    idempotencyKey: `reversal-${row.transfer_id}-${eventKey}-${delta}`,
  });
  const reversed = row.reversed_cents + delta;
  const status: LedgerStatus = reversed >= row.amount_cents ? "reversed" : "transferred";
  getDb()
    .prepare("UPDATE ledger SET reversed_cents = ?, status = ?, reversal_reason = ? WHERE id = ?")
    .run(reversed, status, reason, row.id);
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
  for (const row of rowsFor(order.id)) {
    const target = share(row.amount_cents, input.amountRefunded, input.gross);
    if (row.status === "pending") {
      const status: LedgerStatus = target >= row.amount_cents ? "canceled" : "pending";
      getDb()
        .prepare("UPDATE ledger SET reversed_cents = ?, status = ?, reversal_reason = ? WHERE id = ? AND status = 'pending'")
        .run(target, status, "refund", row.id);
      continue;
    }
    if (row.status === "transferred" || row.status === "reversed") {
      await reverseTransferred(row, target, "refund", input.eventKey);
    }
  }
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
  const gross = order.amountCents;
  for (const row of rowsFor(order.id)) {
    if (row.status !== "transferred" && row.status !== "reversed") continue;
    const target = share(row.amount_cents, input.amount, gross);
    await reverseTransferred(row, target, "dispute", input.disputeId);
  }
}

export async function applyDisputeClosed(input: {
  chargeId: string | null;
  paymentIntentId: string | null;
  status: string;
  disputeId: string;
}) {
  const order = findOrder(input.chargeId, input.paymentIntentId);
  if (!order) return;
  getDb().prepare("UPDATE orders SET dispute_open = 0 WHERE id = ?").run(order.id);
  if (!disputeKeepsFunds(input.status)) {
    getDb()
      .prepare("UPDATE ledger SET status = 'canceled', reversal_reason = 'dispute' WHERE order_id = ? AND status = 'pending'")
      .run(order.id);
    return;
  }
  for (const row of rowsFor(order.id)) {
    if (row.reversal_reason !== "dispute" || row.reversed_cents <= 0) continue;
    const connected = getConnected(row.account_id);
    const current = getOrder(order.id);
    if (!connectReady(connected) || !connected || !current?.chargeId) continue;
    const transfer = await createTransfer({
      amountCents: row.reversed_cents,
      destination: connected.stripeAccountId,
      chargeId: current.chargeId,
      transferGroup: current.transferGroup || `order_${current.id}`,
      idempotencyKey: `restore-${current.id}-${row.party}-${input.disputeId}`,
      orderId: current.id,
      party: row.party,
      accountId: row.account_id,
    });
    if (!transfer.id) throw new Error("Stripe did not return a transfer id.");
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

export function setReview(chargeId: string | null, paymentIntentId: string | null, open: boolean) {
  const order = findOrder(chargeId, paymentIntentId);
  if (!order) return;
  if (open) {
    getDb().prepare("UPDATE orders SET review_open = 1, review_closed = 0 WHERE id = ?").run(order.id);
    return;
  }
  getDb().prepare("UPDATE orders SET review_open = 0, review_closed = 1 WHERE id = ?").run(order.id);
}
