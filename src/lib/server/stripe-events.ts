import { MEMBER_PRICE } from "../account";
import { accountIdByStripe, markMember, setMembershipInactive } from "./accounts";
import { disableConnected, refreshConnected } from "./connect";
import { changed, getDb } from "./db";
import {
  applyDisputeClosed,
  applyDisputeOpened,
  applyRefund,
  setReview,
  settleCheckoutSession,
} from "./ledger";
import { retrieveCheckoutSession, verifyStripeSignature } from "./stripe";

const HANDLED = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "review.opened",
  "review.closed",
  "account.updated",
  "v2.core.account.updated",
  "account.application.deauthorized",
] as const;

type HandledEvent = (typeof HANDLED)[number];

function isHandled(type: string): type is HandledEvent {
  return (HANDLED as readonly string[]).includes(type);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" ? value : null;
}

function whole(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadata(record: Record<string, unknown> | null, key: string) {
  const bag = asRecord(record?.metadata);
  return text(bag, key);
}

function eventObject(event: Record<string, unknown>) {
  return asRecord(asRecord(event.data)?.object);
}

function beginEvent(id: string, type: string) {
  const db = getDb();
  const existing = db.prepare("SELECT status, created_at FROM stripe_events WHERE id = ?").get(id) as
    | { status: string; created_at: number }
    | undefined;
  if (existing?.status === "processed") return "duplicate" as const;
  if (existing?.status === "processing" && Date.now() - existing.created_at < 2 * 60 * 1000) {
    return "duplicate" as const;
  }
  if (existing) db.prepare("DELETE FROM stripe_events WHERE id = ?").run(id);
  db.prepare("INSERT INTO stripe_events (id, type, status, created_at) VALUES (?, ?, 'processing', ?)").run(
    id,
    type,
    Date.now(),
  );
  return "new" as const;
}

function finishEvent(id: string) {
  changed(getDb().prepare("UPDATE stripe_events SET status = 'processed' WHERE id = ?").run(id));
}

function forgetEvent(id: string) {
  getDb().prepare("DELETE FROM stripe_events WHERE id = ?").run(id);
}

function accountIdFrom(record: Record<string, unknown>) {
  return (
    metadata(record, "account_id") ??
    accountIdByStripe({
      customerId: text(record, "customer"),
      subscriptionId: text(record, "id"),
    })
  );
}

const SUBSCRIPTION_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
  "canceled",
  "incomplete_expired",
] as const;

type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

function isSubscriptionStatus(value: string): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

function applySubscription(record: Record<string, unknown>) {
  const accountId = accountIdFrom(record);
  const status = text(record, "status") ?? "";
  if (!accountId) return;
  const customerId = text(record, "customer");
  const subscriptionId = text(record, "id");
  if (!isSubscriptionStatus(status)) {
    setMembershipInactive(accountId, "past_due", customerId, subscriptionId);
    return;
  }
  switch (status) {
    case "active":
      markMember(accountId, customerId, subscriptionId);
      return;
    case "trialing":
    case "past_due":
    case "unpaid":
    case "paused":
    case "incomplete":
      setMembershipInactive(accountId, "past_due", customerId, subscriptionId);
      return;
    case "canceled":
    case "incomplete_expired":
      setMembershipInactive(accountId, "canceled", customerId, subscriptionId);
      return;
    default: {
      const _never: never = status;
      setMembershipInactive(accountId, "past_due", customerId, subscriptionId);
      return _never;
    }
  }
}

async function dispatch(type: HandledEvent, event: Record<string, unknown>) {
  switch (type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const id = text(eventObject(event), "id");
      if (!id) return;
      await settleCheckoutSession(await retrieveCheckoutSession(id));
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = eventObject(event);
      if (!subscription) return;
      if (type === "customer.subscription.deleted") subscription.status = "canceled";
      applySubscription(subscription);
      return;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoice = eventObject(event);
      if (!invoice) return;
      const subscriptionId =
        text(invoice, "subscription") ?? text(asRecord(asRecord(invoice.parent)?.subscription_details), "subscription");
      if (!subscriptionId) return;
      const accountId =
        metadata(invoice, "account_id") ??
        metadata(asRecord(invoice.subscription_details), "account_id") ??
        metadata(asRecord(asRecord(invoice.parent)?.subscription_details), "account_id") ??
        accountIdByStripe({ customerId: text(invoice, "customer"), subscriptionId });
      if (!accountId) return;
      if (type === "invoice.payment_failed") {
        setMembershipInactive(accountId, "past_due", text(invoice, "customer"), subscriptionId);
        return;
      }
      const paid = whole(invoice, "amount_paid");
      if (paid !== MEMBER_PRICE * 100) return;
      markMember(accountId, text(invoice, "customer"), subscriptionId);
      return;
    }
    case "charge.refunded": {
      const charge = eventObject(event);
      if (!charge) return;
      await applyRefund({
        chargeId: text(charge, "id"),
        paymentIntentId: text(charge, "payment_intent"),
        amountRefunded: whole(charge, "amount_refunded") ?? 0,
        gross: whole(charge, "amount") ?? 0,
        eventKey: text(event, "id") ?? "refund",
      });
      return;
    }
    case "charge.dispute.created": {
      const dispute = eventObject(event);
      if (!dispute) return;
      await applyDisputeOpened({
        chargeId: text(dispute, "charge"),
        paymentIntentId: text(dispute, "payment_intent"),
        amount: whole(dispute, "amount") ?? 0,
        disputeId: text(dispute, "id") ?? text(event, "id") ?? "dispute",
      });
      return;
    }
    case "charge.dispute.closed": {
      const dispute = eventObject(event);
      if (!dispute) return;
      await applyDisputeClosed({
        chargeId: text(dispute, "charge"),
        paymentIntentId: text(dispute, "payment_intent"),
        status: text(dispute, "status") ?? "lost",
        disputeId: text(dispute, "id") ?? text(event, "id") ?? "dispute",
      });
      return;
    }
    case "review.opened":
    case "review.closed": {
      const review = eventObject(event);
      if (!review) return;
      setReview(text(review, "charge"), text(review, "payment_intent"), type === "review.opened");
      return;
    }
    case "account.updated":
    case "v2.core.account.updated": {
      const accountId = text(eventObject(event), "id") ?? text(event, "account");
      if (!accountId) return;
      await refreshConnected(accountId);
      return;
    }
    case "account.application.deauthorized": {
      const accountId = text(event, "account") ?? text(eventObject(event), "account");
      if (!accountId) return;
      disableConnected(accountId);
      return;
    }
    default: {
      const _never: never = type;
      return _never;
    }
  }
}

export async function acceptStripeEvent(raw: string, header: string | null, secret: string | undefined) {
  if (!secret) return { status: 503 as const, body: { error: "Stripe webhook secret is not set." } };
  if (!verifyStripeSignature(raw, header, secret)) {
    return { status: 400 as const, body: { error: "Stripe signature did not match." } };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { status: 400 as const, body: { error: "Stripe did not send a readable event." } };
  }
  const event = asRecord(parsed);
  const id = text(event, "id");
  const type = text(event, "type");
  if (!event || !id || !type) return { status: 400 as const, body: { error: "Stripe event was incomplete." } };
  if (beginEvent(id, type) === "duplicate") return { status: 200 as const, body: { received: true, duplicate: true } };
  try {
    if (isHandled(type)) await dispatch(type, event);
    finishEvent(id);
    return { status: 200 as const, body: { received: true } };
  } catch (error) {
    forgetEvent(id);
    const message = error instanceof Error ? error.message : "Stripe event failed.";
    return { status: 500 as const, body: { error: message } };
  }
}
