/**
 * Launch stock rules. Listings are the product (one sku column).
 * Size and color rows live in listing_variants when a product has them.
 * The SKUs to hide or cap live in scripts/stock-caps.json. This module does not
 * choose them.
 * This module never reads or writes orders, the reseller waitlist, or stock holds.
 * No local imports: the prod container runs this file with Node's type stripper.
 */

const SOLD_OUT_LABEL = "Sold out" as const;

export type CapTarget = {
  sku: string;
  cap: number;
};

/** Hide list and cap list from scripts/stock-caps.json. */
export type StockCapPlan = {
  hide: readonly string[];
  caps: readonly CapTarget[];
};

export const ORDER_QTY_MAX = 5;
/** Same window as a Stripe Checkout session. */
export const HOLD_MS = 30 * 60 * 1000;

export function checkoutExpiresAt(nowMs: number) {
  return Math.floor(nowMs / 1000) + HOLD_MS / 1000;
}

export type QtyReason = "qty" | "sold_out" | "hidden" | "choose";

export type QtyDecision = { ok: true; qty: number } | { ok: false; reason: QtyReason };

export type StockNumbers = { cap: number | null; onHand: number | null };

export type StockSql = {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: Array<string | number | bigint | null>): unknown[];
    get(...params: Array<string | number | bigint | null>): unknown;
    run(...params: Array<string | number | bigint | null>): unknown;
  };
};

type WorkRow = {
  kind: "listing" | "variant";
  key: string;
  productId: string;
  variantId: string | null;
  sku: string;
  label: string;
  hidden: number;
  cap: number | null;
  onHand: number | null;
  original: { hidden: number; cap: number | null; onHand: number | null };
  changed: boolean;
};

export function normalizeKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function sqlInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return null;
}

export function sqlChanges(result: unknown) {
  if (typeof result !== "object" || result === null || !("changes" in result)) return 0;
  return sqlInt((result as { changes: unknown }).changes) ?? 0;
}

export function hideMatches(sku: string, hide: readonly string[]) {
  const key = normalizeKey(sku);
  return hide.some((item) => normalizeKey(item) === key);
}

/** Reject a plan that is empty, duplicated, or not whole-number caps. */
export function stockCapPlanFromJson(raw: string): StockCapPlan {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("Stock cap plan is not JSON.");
  }
  if (typeof value !== "object" || value === null) throw new Error("Stock cap plan is not an object.");
  const record = value as { hide?: unknown; caps?: unknown };
  if (!Array.isArray(record.hide) || !Array.isArray(record.caps)) {
    throw new Error("Stock cap plan is missing hide or caps.");
  }
  const hide: string[] = [];
  const caps: CapTarget[] = [];
  const seen = new Set<string>();
  function claimSku(sku: string) {
    const key = normalizeKey(sku);
    if (!key) throw new Error("A stock cap SKU is empty.");
    if (seen.has(key)) throw new Error("A stock cap SKU is listed twice.");
    seen.add(key);
    return key;
  }
  for (const sku of record.hide) {
    if (typeof sku !== "string") throw new Error("A hide target is not a SKU.");
    claimSku(sku);
    hide.push(sku.trim());
  }
  for (const item of record.caps) {
    if (typeof item !== "object" || item === null) throw new Error("A cap target is not an object.");
    const sku = (item as { sku?: unknown }).sku;
    const cap = (item as { cap?: unknown }).cap;
    if (typeof sku !== "string") throw new Error("A cap target is missing a SKU.");
    claimSku(sku);
    if (typeof cap !== "number" || !Number.isInteger(cap) || cap < 0) throw new Error("A cap is not a whole number.");
    caps.push({ sku: sku.trim(), cap });
  }
  if (hide.length === 0 && caps.length === 0) throw new Error("Stock cap plan is empty.");
  return { hide, caps };
}

export function capMatches(target: CapTarget, row: { sku: string }) {
  return normalizeKey(row.sku) === normalizeKey(target.sku);
}

/** First run sets on-hand to the cap. A later run keeps units already sold. */
export function nextStock(state: StockNumbers, cap: number): { cap: number; onHand: number; changed: boolean } {
  if (!Number.isInteger(cap) || cap < 0) throw new Error("Stock cap is not a whole number.");
  if (state.cap == null && state.onHand == null) {
    return { cap, onHand: cap, changed: true };
  }
  const base = state.cap ?? state.onHand ?? cap;
  const onHand = state.onHand ?? base;
  const nextOnHand = Math.max(0, onHand + (cap - base));
  return { cap, onHand: nextOnHand, changed: state.cap !== cap || state.onHand !== nextOnHand };
}

export function unitsLeft(onHand: number | null, held: number) {
  if (onHand == null) return null;
  const reserved = Number.isFinite(held) && held > 0 ? held : 0;
  return Math.max(0, onHand - reserved);
}

export function sellableOnHand(cap: number | null, onHand: number | null) {
  if (onHand != null) return onHand;
  if (cap != null) return cap;
  return null;
}

export function isSoldOut(onHand: number | null, held = 0) {
  const left = unitsLeft(onHand, held);
  return left != null && left <= 0;
}

/** A request above a still-positive shelf is clamped. Sold out is only an empty shelf. */
export function decideQuantity(qty: number, left: number | null, hidden = false): QtyDecision {
  if (hidden) return { ok: false, reason: "hidden" };
  if (!Number.isInteger(qty) || qty < 1 || qty > ORDER_QTY_MAX) return { ok: false, reason: "qty" };
  if (left == null) return { ok: true, qty };
  if (left <= 0) return { ok: false, reason: "sold_out" };
  return { ok: true, qty: Math.min(qty, left) };
}

export function shopperStockError(decision: QtyDecision) {
  if (decision.ok) return null;
  switch (decision.reason) {
    case "qty":
      return "Order between 1 and 5." as const;
    case "sold_out":
      return SOLD_OUT_LABEL;
    case "hidden":
      return "That page is not on the store." as const;
    case "choose":
      return "Choose a product." as const;
    default: {
      const neverReason: never = decision.reason;
      return neverReason;
    }
  }
}

export function formatStockLog(line: {
  sku: string;
  action: "hidden" | "unchanged" | "cap" | "not_found" | "ambiguous" | "restored" | "restore_skipped";
  cap?: number;
  onHand?: number;
}) {
  switch (line.action) {
    case "hidden":
      return `${line.sku} hidden`;
    case "unchanged":
      return line.cap == null ? `${line.sku} unchanged` : `${line.sku} unchanged cap ${line.cap} on_hand ${line.onHand}`;
    case "cap":
      return `${line.sku} cap ${line.cap} on_hand ${line.onHand}`;
    case "not_found":
      return `${line.sku} not_found`;
    case "ambiguous":
      return `${line.sku} ambiguous`;
    case "restored":
      return `${line.sku} restored`;
    case "restore_skipped":
      return `${line.sku} restore_skipped`;
    default: {
      const neverAction: never = line.action;
      return neverAction;
    }
  }
}

function tableExists(db: StockSql, table: string) {
  const row = db.prepare("SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) as
    | { ok?: number }
    | undefined;
  return Boolean(row);
}

function columnNames(db: StockSql, table: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name?: string }[];
  return new Set(rows.map((row) => row.name).filter((name): name is string => Boolean(name)));
}

export function ensureStockSchema(db: StockSql) {
  if (tableExists(db, "listings")) {
    const listing = columnNames(db, "listings");
    if (!listing.has("stock_cap")) db.exec("ALTER TABLE listings ADD COLUMN stock_cap INTEGER");
    if (!listing.has("stock_on_hand")) db.exec("ALTER TABLE listings ADD COLUMN stock_on_hand INTEGER");
  }
  db.exec(`
    CREATE TABLE IF NOT EXISTS listing_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      sku TEXT NOT NULL DEFAULT '',
      label TEXT NOT NULL,
      stock_cap INTEGER,
      stock_on_hand INTEGER,
      hidden INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stock_holds (
      order_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      qty INTEGER NOT NULL,
      state TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS stock_holds_open ON stock_holds (product_id, state, variant_id);
    CREATE TABLE IF NOT EXISTS stock_cap_audit (
      target_key TEXT PRIMARY KEY,
      sku TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      product_id TEXT,
      variant_id TEXT,
      previous_hidden INTEGER,
      previous_cap INTEGER,
      previous_on_hand INTEGER,
      created_at INTEGER NOT NULL
    );
  `);
  if (tableExists(db, "stock_cap_audit") && !columnNames(db, "stock_cap_audit").has("label")) {
    db.exec("ALTER TABLE stock_cap_audit ADD COLUMN label TEXT NOT NULL DEFAULT ''");
  }
}

function reportSku(row: { sku: string; label: string }, fallback: string) {
  return row.sku.trim() || row.label.trim() || fallback;
}

function loadWork(db: StockSql): WorkRow[] {
  const listings = db
    .prepare(
      `SELECT product_id, sku, title, hidden_from_shop, stock_cap, stock_on_hand
       FROM listings
       ORDER BY product_id`,
    )
    .all() as {
    product_id: string;
    sku: string;
    title: string;
    hidden_from_shop: unknown;
    stock_cap: unknown;
    stock_on_hand: unknown;
  }[];
  const variants = db
    .prepare(
      `SELECT id, product_id, sku, label, hidden, stock_cap, stock_on_hand
       FROM listing_variants
       ORDER BY product_id, id`,
    )
    .all() as {
    id: string;
    product_id: string;
    sku: string;
    label: string;
    hidden: unknown;
    stock_cap: unknown;
    stock_on_hand: unknown;
  }[];
  const rows: WorkRow[] = [];
  for (const row of listings) {
    const hidden = sqlInt(row.hidden_from_shop) === 1 ? 1 : 0;
    const cap = sqlInt(row.stock_cap);
    const onHand = sqlInt(row.stock_on_hand);
    rows.push({
      kind: "listing",
      key: `listing:${row.product_id}`,
      productId: row.product_id,
      variantId: null,
      sku: row.sku ?? "",
      label: row.title ?? "",
      hidden,
      cap,
      onHand,
      original: { hidden, cap, onHand },
      changed: false,
    });
  }
  for (const row of variants) {
    const hidden = sqlInt(row.hidden) === 1 ? 1 : 0;
    const cap = sqlInt(row.stock_cap);
    const onHand = sqlInt(row.stock_on_hand);
    rows.push({
      kind: "variant",
      key: `variant:${row.id}`,
      productId: row.product_id,
      variantId: row.id,
      sku: row.sku ?? "",
      label: row.label ?? "",
      hidden,
      cap,
      onHand,
      original: { hidden, cap, onHand },
      changed: false,
    });
  }
  return rows;
}

function remember(db: StockSql, row: WorkRow) {
  db.prepare(
    `INSERT INTO stock_cap_audit (
       target_key, sku, label, product_id, variant_id, previous_hidden, previous_cap, previous_on_hand, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(target_key) DO NOTHING`,
  ).run(
    row.key,
    reportSku(row, row.productId),
    row.label,
    row.productId,
    row.variantId,
    row.original.hidden,
    row.original.cap,
    row.original.onHand,
    Date.now(),
  );
}

function writeRow(db: StockSql, row: WorkRow) {
  if (row.kind === "listing") {
    db.prepare("UPDATE listings SET hidden_from_shop = ?, stock_cap = ?, stock_on_hand = ? WHERE product_id = ?").run(
      row.hidden,
      row.cap,
      row.onHand,
      row.productId,
    );
    return;
  }
  db.prepare("UPDATE listing_variants SET hidden = ?, stock_cap = ?, stock_on_hand = ? WHERE id = ?").run(
    row.hidden,
    row.cap,
    row.onHand,
    row.variantId,
  );
}

function rowsForSku(work: WorkRow[], sku: string) {
  const key = normalizeKey(sku);
  return work.filter((row) => normalizeKey(row.sku) === key);
}

export type StockCapRun = { ok: boolean; lines: string[] };

/**
 * Dry-run unless apply is true. A missing SKU or two rows with the same SKU
 * aborts the whole run and writes nothing.
 */
export function runStockCaps(db: StockSql, apply: boolean, plan: StockCapPlan): StockCapRun {
  db.exec("BEGIN IMMEDIATE");
  try {
    ensureStockSchema(db);
    const work = loadWork(db);
    const lines: string[] = [];
    let problems = 0;
    function claim(sku: string) {
      const matches = rowsForSku(work, sku);
      if (matches.length === 0) {
        lines.push(formatStockLog({ sku, action: "not_found" }));
        problems += 1;
        return null;
      }
      if (matches.length > 1) {
        lines.push(formatStockLog({ sku, action: "ambiguous" }));
        problems += 1;
        return null;
      }
      return matches[0];
    }
    for (const sku of plan.hide) {
      const row = claim(sku);
      if (!row) continue;
      const logged = reportSku(row, sku);
      if (row.hidden === 1) {
        lines.push(formatStockLog({ sku: logged, action: "unchanged" }));
        continue;
      }
      row.hidden = 1;
      row.changed = true;
      lines.push(formatStockLog({ sku: logged, action: "hidden" }));
    }
    for (const target of plan.caps) {
      const row = claim(target.sku);
      if (!row) continue;
      const logged = reportSku(row, target.sku);
      const next = nextStock({ cap: row.cap, onHand: row.onHand }, target.cap);
      if (!next.changed) {
        lines.push(formatStockLog({ sku: logged, action: "unchanged", cap: next.cap, onHand: next.onHand }));
        continue;
      }
      row.cap = next.cap;
      row.onHand = next.onHand;
      row.changed = true;
      lines.push(formatStockLog({ sku: logged, action: "cap", cap: next.cap, onHand: next.onHand }));
    }
    if (problems > 0 || !apply) {
      db.exec("ROLLBACK");
      if (problems > 0) lines.push("aborted");
      else lines.unshift("dry-run");
      return { ok: problems === 0, lines };
    }
    for (const row of work) {
      if (!row.changed) continue;
      remember(db, row);
      writeRow(db, row);
    }
    db.exec("COMMIT");
    return { ok: true, lines };
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction was already closed.
    }
    throw error;
  }
}

type AuditRow = {
  target_key: string;
  sku: string;
  label: string;
  product_id: string | null;
  variant_id: string | null;
  previous_hidden: number;
  previous_cap: number | null;
  previous_on_hand: number | null;
};

function appliedState(
  row: { sku: string; label: string; hidden: number; cap: number | null; onHand: number | null },
  plan: StockCapPlan,
) {
  let hidden = row.hidden;
  let cap = row.cap;
  let onHand = row.onHand;
  if (hideMatches(row.sku, plan.hide)) hidden = 1;
  const target = plan.caps.find((item) => capMatches(item, row));
  if (target) {
    const next = nextStock({ cap, onHand }, target.cap);
    cap = next.cap;
    onHand = next.onHand;
  }
  return { hidden, cap, onHand };
}

function sameState(
  current: { hidden: number; cap: number | null; onHand: number | null },
  applied: { hidden: number; cap: number | null; onHand: number | null },
) {
  return current.hidden === applied.hidden && current.cap === applied.cap && current.onHand === applied.onHand;
}

export function rollbackStockCaps(db: StockSql, plan: StockCapPlan) {
  ensureStockSchema(db);
  const audits = db
    .prepare(
      `SELECT target_key, sku, label, product_id, variant_id, previous_hidden, previous_cap, previous_on_hand
       FROM stock_cap_audit
       ORDER BY sku, target_key`,
    )
    .all() as {
    target_key: string;
    sku: string;
    label: string | null;
    product_id: string | null;
    variant_id: string | null;
    previous_hidden: unknown;
    previous_cap: unknown;
    previous_on_hand: unknown;
  }[];
  if (audits.length === 0) return ["no stock cap audit to restore"];
  const lines: string[] = [];
  for (const audit of audits) {
    const row: AuditRow = {
      target_key: audit.target_key,
      sku: audit.sku,
      label: audit.label ?? "",
      product_id: audit.product_id,
      variant_id: audit.variant_id,
      previous_hidden: sqlInt(audit.previous_hidden) === 1 ? 1 : 0,
      previous_cap: sqlInt(audit.previous_cap),
      previous_on_hand: sqlInt(audit.previous_on_hand),
    };
    const logged = row.sku.trim() || row.label || row.target_key;
    const current = row.variant_id
      ? (db
          .prepare("SELECT hidden, stock_cap, stock_on_hand FROM listing_variants WHERE id = ?")
          .get(row.variant_id) as { hidden: unknown; stock_cap: unknown; stock_on_hand: unknown } | undefined)
      : (db
          .prepare("SELECT hidden_from_shop AS hidden, stock_cap, stock_on_hand FROM listings WHERE product_id = ?")
          .get(row.product_id) as { hidden: unknown; stock_cap: unknown; stock_on_hand: unknown } | undefined);
    if (!current) {
      lines.push(formatStockLog({ sku: logged, action: "restore_skipped" }));
      continue;
    }
    const now = {
      hidden: sqlInt(current.hidden) === 1 ? 1 : 0,
      cap: sqlInt(current.stock_cap),
      onHand: sqlInt(current.stock_on_hand),
    };
    const applied = appliedState(
      {
        sku: row.sku,
        label: row.label,
        hidden: row.previous_hidden,
        cap: row.previous_cap,
        onHand: row.previous_on_hand,
      },
      plan,
    );
    if (!sameState(now, applied)) {
      lines.push(formatStockLog({ sku: logged, action: "restore_skipped" }));
      continue;
    }
    if (row.variant_id) {
      db.prepare("UPDATE listing_variants SET hidden = ?, stock_cap = ?, stock_on_hand = ? WHERE id = ?").run(
        row.previous_hidden,
        row.previous_cap,
        row.previous_on_hand,
        row.variant_id,
      );
    } else {
      db.prepare("UPDATE listings SET hidden_from_shop = ?, stock_cap = ?, stock_on_hand = ? WHERE product_id = ?").run(
        row.previous_hidden,
        row.previous_cap,
        row.previous_on_hand,
        row.product_id,
      );
    }
    db.prepare("DELETE FROM stock_cap_audit WHERE target_key = ?").run(row.target_key);
    lines.push(formatStockLog({ sku: logged, action: "restored" }));
  }
  return lines;
}
