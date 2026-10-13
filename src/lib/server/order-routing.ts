import { addBusinessDays, addBusinessDaysSkipping, formatISODate, isISODate, shipDeadline, storeHolidays } from "../business-days";
import { BLOCKED_TEST_ORDER_NUMBER, isBlockedTestOrder, PLACE_REMIND_MS } from "../order-flags";
import { changed, getDb } from "./db";
import { applyRefund } from "./ledger";
import { sendDelayNoticeMail, sendOpsAlert, sendUnshippedDelayMail } from "./order-mail";
import { createRefund } from "./stripe";
import { getListing, getOrder, issueOrderToken, orderByDelayToken } from "./store";

export async function remindUnplacedOrders(now = Date.now()) {
  const cutoff = now - PLACE_REMIND_MS;
  const rows = getDb()
    .prepare(
      `SELECT id, number
       FROM orders
       WHERE status = 'needs_placing'
         AND place_reminded_at IS NULL
         AND COALESCE(paid_at, created_at) <= ?`,
    )
    .all(cutoff) as { id: string; number: string }[];
  for (const row of rows) {
    if (isBlockedTestOrder(row.number)) continue;
    const claimed = changed(
      getDb()
        .prepare(
          "UPDATE orders SET place_reminded_at = ? WHERE id = ? AND status = 'needs_placing' AND place_reminded_at IS NULL",
        )
        .run(now, row.id),
    );
    if (claimed !== 1) continue;
    const order = getOrder(row.id);
    if (!order) continue;
    const listing = getListing(order.productId);
    await sendOpsAlert({
      kind: "reminder",
      number: order.number,
      title: order.title ?? "Listing",
      sku: order.sku ?? order.productId,
      qty: order.qty,
      supplierOrderUrl: listing?.supplierOrderUrl ?? null,
    });
  }
}

export function flagShippingDelays(now = Date.now()) {
  const rows = getDb()
    .prepare(
      `SELECT id
       FROM orders
       WHERE paid_at IS NOT NULL
         AND shipped_at IS NULL
         AND delivered_at IS NULL
         AND delay_flagged_at IS NULL
         AND had_refund = 0
         AND status NOT IN ('pending', 'test', 'refunded', 'fulfilling')
         AND number != ?`,
    )
    .all(BLOCKED_TEST_ORDER_NUMBER) as { id: string }[];
  for (const row of rows) {
    const order = getOrder(row.id);
    if (!order || isBlockedTestOrder(order.number) || !order.paidAt) continue;
    const listing = getListing(order.productId);
    const deadline = shipDeadline(order.paidAt, listing?.shipDaysMax ?? 0);
    if (now <= deadline) continue;
    getDb().prepare("UPDATE orders SET delay_flagged_at = ? WHERE id = ? AND delay_flagged_at IS NULL").run(now, order.id);
  }
}

let unshippedSweepActive = false;

/**
 * One buyer email for each paid order still unshipped after 7 business days.
 * Weekends and `holidays` are skipped. The row is claimed before the send, so a later run does not send again.
 */
export async function notifyUnshippedDelays(now = Date.now(), holidays = storeHolidays()) {
  if (unshippedSweepActive) return { noticed: 0 };
  unshippedSweepActive = true;
  try {
    const rows = getDb()
      .prepare(
        `SELECT id
         FROM orders
         WHERE paid_at IS NOT NULL
           AND shipped_at IS NULL
           AND delivered_at IS NULL
           AND delay_notice_sent_at IS NULL
           AND had_refund = 0
           AND status NOT IN ('pending', 'test', 'refunded', 'fulfilling', 'shipped', 'delivered')
           AND number != ?`,
      )
      .all(BLOCKED_TEST_ORDER_NUMBER) as { id: string }[];
    let noticed = 0;
    for (const row of rows) {
      const order = getOrder(row.id);
      if (!order || isBlockedTestOrder(order.number) || !order.paidAt) continue;
      if (order.shippedAt || order.deliveredAt) continue;
      if (order.status === "pending" || order.status === "test" || order.status === "refunded") continue;
      if (order.status === "shipped" || order.status === "delivered" || order.status === "fulfilling") continue;
      const deadline = addBusinessDaysSkipping(order.paidAt, 7, holidays);
      if (now <= deadline) continue;
      const claimed = changed(
        getDb()
          .prepare(
            `UPDATE orders
             SET delay_notice_sent_at = ?,
                 delay_flagged_at = COALESCE(delay_flagged_at, ?)
             WHERE id = ?
               AND delay_notice_sent_at IS NULL
               AND shipped_at IS NULL
               AND delivered_at IS NULL
               AND had_refund = 0
               AND status NOT IN ('pending', 'test', 'refunded', 'fulfilling', 'shipped', 'delivered')`,
          )
          .run(now, now, order.id),
      );
      if (claimed !== 1) continue;
      const refundToken = issueOrderToken(order.id, "delay_refund_token_hash");
      await sendUnshippedDelayMail({
        to: order.email,
        number: order.number,
        title: order.title ?? "Order",
        refundToken,
      });
      noticed += 1;
    }
    return { noticed };
  } finally {
    unshippedSweepActive = false;
  }
}

export async function sendDelayNotice(orderId: string, expectedOn: string, now = Date.now()) {
  if (!isISODate(expectedOn)) return { error: "Enter the new expected date." as const };
  const today = new Date(now);
  const todayStamp = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).getTime();
  const [year, month, day] = expectedOn.split("-").map(Number);
  if (Date.UTC(year, month - 1, day) < todayStamp) return { error: "The new expected date has to be today or later." as const };
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (isBlockedTestOrder(order.number) || order.status === "test") {
    return { error: "This test order must not be placed with a supplier." as const };
  }
  if (order.status === "pending") return { error: "This order is not paid." as const };
  if (order.shippedAt || order.deliveredAt || order.status === "shipped" || order.status === "delivered" || order.status === "refunded") {
    return { error: "This order has already shipped." as const };
  }
  getDb()
    .prepare(
      `UPDATE orders
       SET delay_notice_sent_at = COALESCE(delay_notice_sent_at, ?),
           delay_expected_on = ?,
           delay_flagged_at = COALESCE(delay_flagged_at, ?)
       WHERE id = ?`,
    )
    .run(now, expectedOn, now, orderId);
  const refundToken = issueOrderToken(orderId, "delay_refund_token_hash");
  const receiptToken = issueOrderToken(orderId, "customer_link_hash");
  const mailed = await sendDelayNoticeMail({
    to: order.email,
    number: order.number,
    title: order.title ?? "Order",
    expectedOn,
    refundToken,
    receiptToken,
  });
  return { order: getOrder(orderId)!, mailed: mailed.sent };
}

export async function acceptDelayRefund(token: string, now = Date.now()) {
  const order = orderByDelayToken(token);
  if (!order) return { status: 404 as const, error: "That refund link does not match an order." };
  if (isBlockedTestOrder(order.number) || order.status === "test") {
    return { status: 400 as const, error: "This test order cannot be refunded from this link." };
  }
  if (!order.delayNoticeSentAt) return { status: 400 as const, error: "There is no delay notice on this order." };
  if (order.delayRefundedAt || order.status === "refunded") {
    return { status: 200 as const, order: getOrder(order.id)!, refunded: true };
  }
  const dueAt = order.delayRefundDueAt ?? addBusinessDays(now, 7);
  if (!order.delayRefundRequestedAt) {
    getDb()
      .prepare("UPDATE orders SET delay_refund_requested_at = ?, delay_refund_due_at = ? WHERE id = ?")
      .run(now, dueAt, order.id);
  }
  try {
    await createRefund({
      chargeId: order.chargeId,
      paymentIntentId: order.paymentIntentId,
      amountCents: order.amountCents,
      idempotencyKey: `delay-refund-${order.id}`,
    });
    await applyRefund({
      chargeId: order.chargeId,
      paymentIntentId: order.paymentIntentId,
      amountRefunded: order.amountCents,
      gross: order.amountCents,
      eventKey: `delay-refund-${order.id}`,
    });
    getDb()
      .prepare("UPDATE orders SET delay_refunded_at = ?, status = 'refunded', supplier_detail = ? WHERE id = ?")
      .run(now, "Refunded in Stripe after the delay notice.", order.id);
    return { status: 200 as const, order: getOrder(order.id)!, refunded: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe did not refund the charge.";
    console.error(message);
    const dueLabel = formatISODate(new Date(dueAt).toISOString().slice(0, 10));
    return {
      status: 502 as const,
      error: `The refund is due by ${dueLabel}. Stripe did not complete it yet.`,
      order: getOrder(order.id)!,
    };
  }
}
