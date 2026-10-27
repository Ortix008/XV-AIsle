import { STOCK_REVIEW_FLAG } from "../order-flags";
import {
  HOLD_MS,
  decideQuantity,
  isSoldOut,
  sellableOnHand,
  shopperStockError,
  sqlChanges,
  sqlInt,
  unitsLeft,
  type StockSql,
} from "../stock-caps";
import { getDb } from "./db";

type VariantRow = {
  id: string;
  sku: string;
  label: string;
  hidden: unknown;
  stock_cap: unknown;
  stock_on_hand: unknown;
};

export type ShopVariant = {
  id: string;
  label: string;
  soldOut: boolean;
  unitsLeft: number | null;
};

export type ShopStock = {
  soldOut: boolean;
  unitsLeft: number | null;
  variants: ShopVariant[];
};

export type StockGate =
  | { ok: true; tracked: boolean; variantId: string | null; qty: number }
  | { ok: false; error: "Sold out" | "Order between 1 and 5." | "That page is not on the store." | "Choose a product." };

export type PaidStock = "committed" | "already" | "untracked" | "short";

function database() {
  return getDb() as unknown as StockSql;
}

/** Drop holds for pending orders whose checkout window has closed. Does not change the order. */
export function releaseStaleHolds(now = Date.now()) {
  database()
    .prepare(
      `UPDATE stock_holds
       SET state = 'released'
       WHERE state = 'held'
         AND created_at <= ?
         AND order_id IN (SELECT id FROM orders WHERE status = 'pending')`,
    )
    .run(now - HOLD_MS);
}

function heldQty(productId: string, variantId: string | null, now: number) {
  const row = variantId
    ? (database()
        .prepare(
          `SELECT COALESCE(SUM(qty), 0) AS qty
           FROM stock_holds
           WHERE state = 'held' AND product_id = ? AND variant_id = ? AND created_at > ?`,
        )
        .get(productId, variantId, now - HOLD_MS) as { qty: unknown } | undefined)
    : (database()
        .prepare(
          `SELECT COALESCE(SUM(qty), 0) AS qty
           FROM stock_holds
           WHERE state = 'held' AND product_id = ? AND variant_id IS NULL AND created_at > ?`,
        )
        .get(productId, now - HOLD_MS) as { qty: unknown } | undefined);
  return sqlInt(row?.qty) ?? 0;
}

function variantsFor(productId: string) {
  return database()
    .prepare(
      `SELECT id, sku, label, hidden, stock_cap, stock_on_hand
       FROM listing_variants
       WHERE product_id = ?
       ORDER BY label, id`,
    )
    .all(productId) as VariantRow[];
}

function listingStock(productId: string) {
  return database()
    .prepare(
      `SELECT published, hidden_from_shop, stock_cap, stock_on_hand
       FROM listings
       WHERE product_id = ?`,
    )
    .get(productId) as
    | { published: unknown; hidden_from_shop: unknown; stock_cap: unknown; stock_on_hand: unknown }
    | undefined;
}

export function evaluateStock(input: { productId: string; variantId: string | null; qty: number; now?: number }): StockGate {
  const now = input.now ?? Date.now();
  releaseStaleHolds(now);
  const listing = listingStock(input.productId);
  if (!listing || sqlInt(listing.published) !== 1 || sqlInt(listing.hidden_from_shop) === 1) {
    return { ok: false, error: "That page is not on the store." };
  }
  const variants = variantsFor(input.productId);
  const visible = variants.filter((row) => sqlInt(row.hidden) !== 1);
  if (input.variantId) {
    const variant = variants.find((row) => row.id === input.variantId);
    if (!variant || sqlInt(variant.hidden) === 1) return { ok: false, error: "That page is not on the store." };
    const onHand = sellableOnHand(sqlInt(variant.stock_cap), sqlInt(variant.stock_on_hand));
    const decision = decideQuantity(input.qty, unitsLeft(onHand, heldQty(input.productId, variant.id, now)));
    const error = shopperStockError(decision);
    if (error || !decision.ok) return { ok: false, error: error ?? "Sold out" };
    return { ok: true, tracked: onHand != null, variantId: variant.id, qty: decision.qty };
  }
  if (variants.length > 0) {
    if (visible.length === 0) return { ok: false, error: "That page is not on the store." };
    return { ok: false, error: "Choose a product." };
  }
  const onHand = sellableOnHand(sqlInt(listing.stock_cap), sqlInt(listing.stock_on_hand));
  const decision = decideQuantity(input.qty, unitsLeft(onHand, heldQty(input.productId, null, now)));
  const error = shopperStockError(decision);
  if (error || !decision.ok) return { ok: false, error: error ?? "Sold out" };
  return { ok: true, tracked: onHand != null, variantId: null, qty: decision.qty };
}

export function writeHold(input: { orderId: string; productId: string; variantId: string | null; qty: number; now: number }) {
  database()
    .prepare(
      `INSERT INTO stock_holds (order_id, product_id, variant_id, qty, state, created_at)
       VALUES (?, ?, ?, ?, 'held', ?)`,
    )
    .run(input.orderId, input.productId, input.variantId, input.qty, input.now);
}

/** Drop a pending hold when checkout is canceled or the session expires. A paid hold stays. */
export function releaseHeldStock(orderId: string, productId?: string) {
  const db = database();
  const order = (
    productId
      ? db.prepare("SELECT status FROM orders WHERE id = ? AND product_id = ?").get(orderId, productId)
      : db.prepare("SELECT status FROM orders WHERE id = ?").get(orderId)
  ) as { status: string } | undefined;
  if (!order || order.status !== "pending") return false;
  const updated = db.prepare("UPDATE stock_holds SET state = 'released' WHERE order_id = ? AND state = 'held'").run(orderId);
  return sqlChanges(updated) === 1;
}

/**
 * Move reserved units into stock_on_hand once, when the order is paid.
 * A hold that already expired still decrements. If that would go below zero,
 * the order is flagged for review and nothing is subtracted.
 */
export function commitPaidStock(orderId: string): PaidStock {
  const db = database();
  db.exec("BEGIN IMMEDIATE");
  try {
    const hold = db
      .prepare("SELECT product_id, variant_id, qty, state FROM stock_holds WHERE order_id = ?")
      .get(orderId) as { product_id: string; variant_id: string | null; qty: unknown; state: string } | undefined;
    if (!hold) {
      db.exec("COMMIT");
      return "untracked";
    }
    if (hold.state === "committed") {
      db.exec("COMMIT");
      return "already";
    }
    const qty = sqlInt(hold.qty) ?? 0;
    const open = hold.state === "held" || hold.state === "released" || hold.state === "short";
    const updated =
      open && qty > 0
        ? hold.variant_id
          ? db
              .prepare(
                `UPDATE listing_variants
                 SET stock_on_hand = stock_on_hand - ?
                 WHERE id = ? AND stock_on_hand >= ?`,
              )
              .run(qty, hold.variant_id, qty)
          : db
              .prepare(
                `UPDATE listings
                 SET stock_on_hand = stock_on_hand - ?
                 WHERE product_id = ? AND stock_on_hand >= ?`,
              )
              .run(qty, hold.product_id, qty)
        : null;
    const changes = updated ? sqlChanges(updated) : 0;
    if (changes === 1) {
      db.prepare("UPDATE stock_holds SET state = 'committed' WHERE order_id = ?").run(orderId);
      db.prepare("UPDATE orders SET fulfillment_flag = NULL WHERE id = ? AND fulfillment_flag = ?").run(
        orderId,
        STOCK_REVIEW_FLAG,
      );
      db.exec("COMMIT");
      return "committed";
    }
    db.prepare(
      "UPDATE orders SET fulfillment_flag = ? WHERE id = ? AND (fulfillment_flag IS NULL OR fulfillment_flag = ?)",
    ).run(STOCK_REVIEW_FLAG, orderId, STOCK_REVIEW_FLAG);
    db.prepare("UPDATE stock_holds SET state = 'short' WHERE order_id = ? AND state IN ('held', 'released', 'short')").run(
      orderId,
    );
    db.exec("COMMIT");
    console.error("Paid order is short on stock.");
    return "short";
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction was already closed.
    }
    throw error;
  }
}

function variantView(row: VariantRow, productId: string, now: number): ShopVariant {
  const onHand = sellableOnHand(sqlInt(row.stock_cap), sqlInt(row.stock_on_hand));
  const left = unitsLeft(onHand, heldQty(productId, row.id, now));
  return {
    id: row.id,
    label: row.label,
    soldOut: isSoldOut(onHand, heldQty(productId, row.id, now)),
    unitsLeft: left,
  };
}

export function readShopStock(productId: string, now = Date.now()): ShopStock {
  releaseStaleHolds(now);
  const listing = listingStock(productId);
  const visible = variantsFor(productId).filter((row) => sqlInt(row.hidden) !== 1);
  if (visible.length > 0) {
    const variants = visible.map((row) => variantView(row, productId, now));
    const soldOut = variants.every((row) => row.soldOut);
    return { soldOut, unitsLeft: soldOut ? 0 : null, variants };
  }
  const onHand = listing ? sellableOnHand(sqlInt(listing.stock_cap), sqlInt(listing.stock_on_hand)) : null;
  const left = unitsLeft(onHand, heldQty(productId, null, now));
  return { soldOut: isSoldOut(onHand, heldQty(productId, null, now)), unitsLeft: left, variants: [] };
}

export function soldOutByProduct(productIds: string[], now = Date.now()) {
  const flags = new Map<string, boolean>();
  if (productIds.length === 0) return flags;
  releaseStaleHolds(now);
  for (const productId of productIds) {
    flags.set(productId, readShopStock(productId, now).soldOut);
  }
  return flags;
}
