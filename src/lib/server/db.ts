import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

let db: DatabaseSync | null = null;

export function getDb() {
  if (db) return db;
  const path = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const next = new DatabaseSync(path);
  next.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      member_since INTEGER,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      role TEXT NOT NULL DEFAULT 'buyer',
      membership_status TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listings (
      product_id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      image TEXT NOT NULL,
      supplier_name TEXT NOT NULL,
      supplier_origin TEXT NOT NULL,
      ship_days_min INTEGER NOT NULL,
      ship_days_max INTEGER NOT NULL,
      published INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      number TEXT NOT NULL UNIQUE,
      product_id TEXT NOT NULL,
      account_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      qty INTEGER NOT NULL,
      amount_cents INTEGER NOT NULL,
      ship_line1 TEXT NOT NULL,
      ship_city TEXT NOT NULL,
      ship_region TEXT NOT NULL,
      ship_postal TEXT NOT NULL,
      ship_country TEXT NOT NULL,
      stripe_session_id TEXT UNIQUE,
      status TEXT NOT NULL,
      supplier_ref TEXT,
      supplier_detail TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS floor_reach (
      account_id TEXT NOT NULL,
      floor_id TEXT NOT NULL,
      status TEXT NOT NULL,
      contact TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (account_id, floor_id)
    );
    CREATE TABLE IF NOT EXISTS rate_hits (
      key TEXT NOT NULL,
      at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS small_shops (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      makes TEXT NOT NULL,
      made_in_usa INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS inquiries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS connected_accounts (
      account_id TEXT PRIMARY KEY,
      stripe_account_id TEXT NOT NULL UNIQUE,
      charges_enabled INTEGER NOT NULL DEFAULT 0,
      payouts_enabled INTEGER NOT NULL DEFAULT 0,
      details_submitted INTEGER NOT NULL DEFAULT 0,
      requirements_due TEXT NOT NULL DEFAULT '',
      transfers_status TEXT NOT NULL DEFAULT 'pending',
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      party TEXT NOT NULL,
      account_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      status TEXT NOT NULL,
      transfer_id TEXT,
      reversed_cents INTEGER NOT NULL DEFAULT 0,
      reversal_reason TEXT,
      UNIQUE(order_id, party)
    );
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS email_verifications (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS supplier_secrets (
      account_id TEXT PRIMARY KEY,
      secret_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS supplier_catalog (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      title TEXT NOT NULL,
      cost_cents INTEGER NOT NULL,
      shipping_cents INTEGER NOT NULL,
      origin TEXT NOT NULL,
      approved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_seq (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      next_number INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS login_challenges (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ledger_transfers (
      id TEXT PRIMARY KEY,
      ledger_id TEXT NOT NULL,
      order_id TEXT NOT NULL,
      party TEXT NOT NULL,
      transfer_id TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      kind TEXT NOT NULL,
      reason TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  // New databases get buyer as the default. Rows that already have a role are not rewritten.
  // Promote each owner with admin:create. Boot does not demote reseller, supplier, or admin.
  addColumn(next, "accounts", "role", "TEXT NOT NULL DEFAULT 'buyer'");
  addColumn(next, "accounts", "membership_status", "TEXT");
  addColumn(next, "accounts", "email_verified", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "accounts", "failed_logins", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "accounts", "locked_until", "INTEGER");
  addColumn(next, "accounts", "totp_secret", "TEXT");
  addColumn(next, "accounts", "totp_enabled", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "listings", "made_in_usa", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "listings", "shelf", "TEXT NOT NULL DEFAULT 'national'");
  addColumn(next, "listings", "supplier_account_id", "TEXT");
  addColumn(next, "listings", "supplier_cost_cents", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "listings", "supplier_shipping_cents", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "listings", "fee_bps", "INTEGER");
  addColumn(next, "listings", "catalog_item_id", "TEXT");
  addColumn(next, "orders", "payment_intent_id", "TEXT");
  addColumn(next, "orders", "charge_id", "TEXT");
  addColumn(next, "orders", "transfer_group", "TEXT");
  addColumn(next, "orders", "fee_bps", "INTEGER");
  addColumn(next, "orders", "platform_fee_cents", "INTEGER");
  addColumn(next, "orders", "supplier_amount_cents", "INTEGER");
  addColumn(next, "orders", "reseller_amount_cents", "INTEGER");
  addColumn(next, "orders", "supplier_account_id", "TEXT");
  addColumn(next, "orders", "delivered_at", "INTEGER");
  addColumn(next, "orders", "risk_level", "TEXT");
  addColumn(next, "orders", "risk_type", "TEXT");
  addColumn(next, "orders", "risk_approved", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "review_open", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "review_closed", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "dispute_open", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "paid_at", "INTEGER");
  addColumn(next, "orders", "carrier", "TEXT");
  addColumn(next, "orders", "tracking_number", "TEXT");
  addColumn(next, "orders", "shipped_at", "INTEGER");
  addColumn(next, "orders", "buyer_confirmed_at", "INTEGER");
  addColumn(next, "orders", "buyer_dispute_open", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "buyer_dispute_resolved", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "buyer_dispute_note", "TEXT");
  addColumn(next, "orders", "receipt_token_hash", "TEXT");
  addColumn(next, "orders", "fulfilling_started_at", "INTEGER");
  addColumn(next, "orders", "fulfillment_attempts", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "orders", "fulfillment_flag", "TEXT");
  addColumn(next, "orders", "refund_required", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "ledger_transfers", "reason", "TEXT");
  addColumn(next, "orders", "stripe_fee_est_cents", "INTEGER");
  addColumn(next, "orders", "stripe_fee_cents", "INTEGER");
  db = next;
  return next;
}

function addColumn(database: DatabaseSync, table: string, column: string, definition: string) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function changed(result: unknown) {
  if (typeof result !== "object" || result === null || !("changes" in result)) return 0;
  const value = (result as { changes: unknown }).changes;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  return 0;
}

export function closeDb() {
  db?.close();
  db = null;
}
