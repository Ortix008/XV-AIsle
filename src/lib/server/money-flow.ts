import { randomUUID } from "node:crypto";
import { referralId } from "@/lib/referral";
import { RESELLER_COMMISSION_BPS, RETURN_WINDOW_DAYS } from "@/lib/policies";
import { verifiedAdmin, type Actor } from "./access";
import { getAccount } from "./accounts";
import { getDb } from "./db";
import { dollars, estimateStripeFee, minRetailCents } from "./fees";

const DAY_MS = 24 * 60 * 60 * 1000;
const COMMISSION_BPS_MAX = 5000;

export type CommissionReason = "refund" | "return" | "dispute";

type CommissionStatus = "pending" | "payable" | "batched" | "void" | "reversed";

function clampBps(raw: string | undefined) {
  const trimmed = raw?.trim();
  if (!trimmed) return RESELLER_COMMISSION_BPS;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return RESELLER_COMMISSION_BPS;
  return Math.min(COMMISSION_BPS_MAX, Math.max(0, parsed));
}

/** Reseller commission rate. Default 5%. RESELLER_COMMISSION_BPS overrides it. */
export function resellerCommissionBps() {
  return clampBps(process.env.RESELLER_COMMISSION_BPS);
}

export function commissionCents(itemPriceCents: number, bps = resellerCommissionBps()) {
  if (!Number.isInteger(itemPriceCents) || itemPriceCents <= 0 || bps <= 0) return 0;
  return Math.round((itemPriceCents * bps) / 10000);
}

/**
 * Block a price that cannot cover wholesale, the card fee, and the maximum reseller commission.
 * The floor is one cent. The retail price also has to meet the store minimum.
 */
export function marginGuard(priceCents: number, wholesaleCost: number) {
  if (!Number.isInteger(priceCents) || priceCents < minRetailCents()) {
    return `Set a price of at least ${dollars(minRetailCents())}.`;
  }
  if (!Number.isInteger(wholesaleCost) || wholesaleCost < 0) {
    return "Wholesale cost has to be zero or more.";
  }
  const stripe = estimateStripeFee(priceCents);
  const commission = commissionCents(priceCents);
  const margin = priceCents - wholesaleCost - stripe - commission;
  if (margin < 1) {
    return "This price does not cover wholesale cost, the card fee, and commission.";
  }
  return null;
}

export function saveWholesaleCost(account: Actor | null, productId: string, wholesaleCost: number) {
  const denied = verifiedAdmin(account);
  if (denied) return { status: denied.status, error: denied.error };
  if (!productId || productId.length > 80) return { status: 400 as const, error: "Name the product." };
  const row = getDb().prepare("SELECT price_cents FROM listings WHERE product_id = ?").get(productId) as
    | { price_cents: number }
    | undefined;
  if (!row) return { status: 404 as const, error: "That product is not on file." };
  const problem = marginGuard(row.price_cents, wholesaleCost);
  if (problem) return { status: 400 as const, error: problem };
  getDb().prepare("UPDATE listings SET wholesale_cost = ? WHERE product_id = ?").run(wholesaleCost, productId);
  return { status: 200 as const, wholesaleCost };
}

/** Copy the item price and the wholesale cost onto the order. Shipping and tax are not included. */
export function snapshotOrderCost(orderId: string, productId: string, qty: number, priceCents: number) {
  const row = getDb().prepare("SELECT wholesale_cost FROM listings WHERE product_id = ?").get(productId) as
    | { wholesale_cost: number | null }
    | undefined;
  const itemPrice = priceCents * qty;
  getDb()
    .prepare("UPDATE orders SET item_price_cents = ?, wholesale_cost = ? WHERE id = ?")
    .run(itemPrice, row?.wholesale_cost ?? null, orderId);
}

/** Remember a reseller from ?ref= when that account is a reseller. */
export function attachReferrer(orderId: string, ref: string | null) {
  const id = referralId(ref);
  if (!id) return;
  const account = getAccount(id);
  if (!account || account.role !== "reseller") return;
  getDb()
    .prepare("UPDATE orders SET referrer_account_id = ? WHERE id = ? AND referrer_account_id IS NULL")
    .run(account.id, orderId);
}

type PaidRow = {
  id: string;
  qty: number;
  amount_cents: number;
  item_price_cents: number | null;
  wholesale_cost: number | null;
  stripe_fee_cents: number | null;
  stripe_fee_est_cents: number | null;
  referrer_account_id: string | null;
  status: string;
};

/** Book the supplier wholesale, the platform margin, and a pending reseller commission. No Stripe transfer. */
export function recordPaidSale(orderId: string) {
  const db = getDb();
  const already = db.prepare("SELECT order_id FROM order_money WHERE order_id = ?").get(orderId);
  if (already) return;
  const order = db
    .prepare(
      `SELECT id, qty, amount_cents, item_price_cents, wholesale_cost, stripe_fee_cents, stripe_fee_est_cents,
              referrer_account_id, status
       FROM orders WHERE id = ?`,
    )
    .get(orderId) as PaidRow | undefined;
  if (!order || order.status === "pending") return;
  const itemPrice = order.item_price_cents ?? order.amount_cents;
  const stripe = order.stripe_fee_cents ?? order.stripe_fee_est_cents ?? estimateStripeFee(itemPrice);
  const referrer = order.referrer_account_id ? getAccount(order.referrer_account_id) : null;
  const rate = resellerCommissionBps();
  const commission = referrer?.role === "reseller" ? commissionCents(itemPrice, rate) : 0;
  const wholesaleTotal = order.wholesale_cost == null ? null : order.wholesale_cost * order.qty;
  const margin = wholesaleTotal == null ? null : itemPrice - wholesaleTotal - stripe - commission;
  db.prepare(
    `INSERT INTO order_money (
       order_id, item_price_cents, wholesale_cost, wholesale_total_cents, stripe_fee_cents,
       commission_cents, platform_margin_cents, referrer_account_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    order.id,
    itemPrice,
    order.wholesale_cost,
    wholesaleTotal,
    stripe,
    commission,
    margin,
    referrer?.role === "reseller" ? referrer.id : null,
  );
  if (commission > 0 && referrer?.role === "reseller") {
    db.prepare(
      `INSERT INTO reseller_commissions (
         id, order_id, account_id, item_price_cents, rate_bps, amount_cents, status, batch_id, reason, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, NULL, ?)`,
    ).run(randomUUID(), order.id, referrer.id, itemPrice, rate, commission, Date.now());
  }
}

function reasonLabel(reason: CommissionReason) {
  switch (reason) {
    case "refund":
    case "return":
    case "dispute":
      return reason;
    default: {
      const never: never = reason;
      return never;
    }
  }
}

/** A refund, return, or dispute voids a commission, or books reseller debt if it was already batched. */
export function voidResellerCommission(orderId: string, reason: CommissionReason) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id, account_id, amount_cents, status FROM reseller_commissions WHERE order_id = ?`,
    )
    .get(orderId) as { id: string; account_id: string; amount_cents: number; status: string } | undefined;
  if (!row) return;
  const status = row.status as CommissionStatus;
  if (status === "void" || status === "reversed") return;
  const label = reasonLabel(reason);
  if (status === "batched") {
    db.prepare("UPDATE reseller_commissions SET status = 'reversed', reason = ? WHERE id = ?").run(label, row.id);
    db.prepare(
      `INSERT INTO reseller_debts (id, account_id, order_id, amount_cents, open_cents, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'open', ?)
       ON CONFLICT(order_id) DO NOTHING`,
    ).run(randomUUID(), row.account_id, orderId, row.amount_cents, row.amount_cents, Date.now());
    return;
  }
  db.prepare("UPDATE reseller_commissions SET status = 'void', reason = ? WHERE id = ?").run(label, row.id);
}

function windowMs() {
  return RETURN_WINDOW_DAYS * DAY_MS;
}

type OpenCommission = {
  id: string;
  order_id: string;
  account_id: string;
  amount_cents: number;
};

const MATURE_SQL = `
  SELECT c.id, c.order_id, c.account_id, c.amount_cents
  FROM reseller_commissions c
  JOIN orders o ON o.id = c.order_id
  WHERE c.status = ?
    AND o.delivered_at IS NOT NULL
    AND o.delivered_at + ? <= ?
    AND COALESCE(o.had_refund, 0) = 0
    AND COALESCE(o.dispute_open, 0) = 0
    AND COALESCE(o.buyer_dispute_open, 0) = 0
    AND COALESCE(o.had_dispute, 0) = 0
    AND o.status != 'refunded'
`;

function periodKey(now: number) {
  const date = new Date(now);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

export type CommissionBatch = {
  id: string;
  accountId: string;
  period: string;
  grossCents: number;
  debtCents: number;
  netCents: number;
  orderIds: string[];
};

/**
 * Mark matured commissions payable, then write one batch per reseller.
 * The batch record is the payout mark. It does not create a Stripe transfer.
 */
export function runMonthlyBatch(now = Date.now()): { batches: CommissionBatch[] } {
  const db = getDb();
  const hold = windowMs();
  db.exec("BEGIN");
  try {
    const ready = db.prepare(MATURE_SQL).all("pending", hold, now) as OpenCommission[];
    const mark = db.prepare("UPDATE reseller_commissions SET status = 'payable' WHERE id = ? AND status = 'pending'");
    for (const row of ready) mark.run(row.id);
    const payable = db.prepare(MATURE_SQL).all("payable", hold, now) as OpenCommission[];
    const groups = new Map<string, OpenCommission[]>();
    for (const row of payable) {
      const list = groups.get(row.account_id) ?? [];
      list.push(row);
      groups.set(row.account_id, list);
    }
    const batches: CommissionBatch[] = [];
    const period = periodKey(now);
    for (const [accountId, rows] of groups) {
      const gross = rows.reduce((sum, row) => sum + row.amount_cents, 0);
      let net = gross;
      let debtUsed = 0;
      const debts = db
        .prepare(
          `SELECT id, open_cents FROM reseller_debts
           WHERE account_id = ? AND status = 'open' AND open_cents > 0
           ORDER BY created_at`,
        )
        .all(accountId) as { id: string; open_cents: number }[];
      for (const debt of debts) {
        if (net <= 0) break;
        const bite = Math.min(net, debt.open_cents);
        net -= bite;
        debtUsed += bite;
        const open = debt.open_cents - bite;
        db.prepare("UPDATE reseller_debts SET open_cents = ?, status = ? WHERE id = ?").run(
          open,
          open === 0 ? "applied" : "open",
          debt.id,
        );
      }
      const id = randomUUID();
      db.prepare(
        `INSERT INTO reseller_commission_batches (
           id, account_id, period, gross_cents, debt_cents, net_cents, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'batched', ?)`,
      ).run(id, accountId, period, gross, debtUsed, net, now);
      const stamp = db.prepare(
        "UPDATE reseller_commissions SET status = 'batched', batch_id = ? WHERE id = ? AND status = 'payable'",
      );
      for (const row of rows) stamp.run(id, row.id);
      batches.push({
        id,
        accountId,
        period,
        grossCents: gross,
        debtCents: debtUsed,
        netCents: net,
        orderIds: rows.map((row) => row.order_id),
      });
    }
    db.exec("COMMIT");
    return { batches };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function orderMoney(orderId: string) {
  return (
    (getDb().prepare("SELECT * FROM order_money WHERE order_id = ?").get(orderId) as
      | {
          order_id: string;
          item_price_cents: number;
          wholesale_cost: number | null;
          wholesale_total_cents: number | null;
          stripe_fee_cents: number;
          commission_cents: number;
          platform_margin_cents: number | null;
          referrer_account_id: string | null;
        }
      | undefined) ?? null
  );
}

export function commissionFor(orderId: string) {
  return (
    (getDb()
      .prepare(
        `SELECT id, order_id, account_id, item_price_cents, rate_bps, amount_cents, status, batch_id, reason
         FROM reseller_commissions WHERE order_id = ?`,
      )
      .get(orderId) as
      | {
          id: string;
          order_id: string;
          account_id: string;
          item_price_cents: number;
          rate_bps: number;
          amount_cents: number;
          status: string;
          batch_id: string | null;
          reason: string | null;
        }
      | undefined) ?? null
  );
}

export function debtsFor(accountId: string) {
  return getDb()
    .prepare(
      `SELECT id, account_id, order_id, amount_cents, open_cents, status
       FROM reseller_debts WHERE account_id = ? ORDER BY created_at`,
    )
    .all(accountId) as {
    id: string;
    account_id: string;
    order_id: string;
    amount_cents: number;
    open_cents: number;
    status: string;
  }[];
}
