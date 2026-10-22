import { SOLD_OUT_LABEL } from "../sold-out";
import { changed, getDb } from "./db";

export type StockOffer = {
  size: string;
  sku: string;
  stockCount: number | null;
};

export function parseSizeOffer(raw: string | null | undefined) {
  if (!raw) return [] as { size: string; sku: string }[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const offers: { size: string; sku: string }[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as { size?: unknown; sku?: unknown };
      if (typeof record.size !== "string" || typeof record.sku !== "string" || !record.size || !record.sku) continue;
      offers.push({ size: record.size, sku: record.sku });
    }
    return offers;
  } catch {
    return [];
  }
}

function stockMap(productId: string) {
  const rows = getDb().prepare("SELECT sku, stock_count FROM listing_stock WHERE product_id = ?").all(productId) as {
    sku: string;
    stock_count: number | null;
  }[];
  return new Map(rows.map((row) => [row.sku, row.stock_count]));
}

export function listingStock(
  productId: string,
  listingSku: string,
  sizeOffer: string | null | undefined,
  columnCount: number | null,
) {
  const sizes = parseSizeOffer(sizeOffer);
  const counts = stockMap(productId);
  if (sizes.length > 0) {
    return {
      stockCount: null as number | null,
      offers: sizes.map((offer) => ({
        size: offer.size,
        sku: offer.sku,
        stockCount: counts.has(offer.sku) ? (counts.get(offer.sku) ?? null) : null,
      })),
    };
  }
  const stockCount = counts.has(listingSku) ? (counts.get(listingSku) ?? null) : columnCount;
  return { stockCount, offers: [] as StockOffer[] };
}

function syncParentCount(productId: string) {
  getDb()
    .prepare(
      `UPDATE listings
       SET stock_count = (
         SELECT stock_count FROM listing_stock
         WHERE product_id = listings.product_id AND sku = listings.sku
       )
       WHERE product_id = ?`,
    )
    .run(productId);
}

/** Operator set. Turns the cap on and leaves published alone. */
export function writeSkuStock(productId: string, sku: string, stockCount: number | null) {
  getDb()
    .prepare(
      `INSERT INTO listing_stock (product_id, sku, stock_count) VALUES (?, ?, ?)
       ON CONFLICT(product_id, sku) DO UPDATE SET stock_count = excluded.stock_count`,
    )
    .run(productId, sku, stockCount);
  getDb().prepare("UPDATE listings SET stock_cap = 1 WHERE product_id = ?").run(productId);
  syncParentCount(productId);
}

export function claimSkuStock(productId: string, sku: string, qty: number): { ok: true } | { error: string } {
  const db = getDb();
  const listing = db.prepare("SELECT stock_cap FROM listings WHERE product_id = ?").get(productId) as
    | { stock_cap: number | null }
    | undefined;
  if (!listing || listing.stock_cap !== 1) return { ok: true };
  const row = db.prepare("SELECT stock_count FROM listing_stock WHERE product_id = ? AND sku = ?").get(productId, sku) as
    | { stock_count: number | null }
    | undefined;
  if (!row || row.stock_count == null) return { error: "That page is not on the store." };
  const result = db
    .prepare("UPDATE listing_stock SET stock_count = stock_count - ? WHERE product_id = ? AND sku = ? AND stock_count >= ?")
    .run(qty, productId, sku, qty);
  if (changed(result) !== 1) return { error: SOLD_OUT_LABEL };
  syncParentCount(productId);
  return { ok: true };
}

export function orderSku(
  offers: StockOffer[],
  listingSku: string,
  requested: string | undefined,
): { sku: string } | { error: "That page is not on the store." } {
  if (offers.length > 0) {
    const match = offers.find((offer) => offer.sku === requested);
    if (!match) return { error: "That page is not on the store." };
    return { sku: match.sku };
  }
  if (requested && requested !== listingSku) return { error: "That page is not on the store." };
  return { sku: listingSku };
}
