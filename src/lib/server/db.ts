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
      stripe_subscription_id TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS payouts (
      account_id TEXT PRIMARY KEY,
      method TEXT NOT NULL,
      last4 TEXT NOT NULL,
      wallet TEXT
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
  `);
  addColumn(next, "listings", "made_in_usa", "INTEGER NOT NULL DEFAULT 0");
  addColumn(next, "listings", "shelf", "TEXT NOT NULL DEFAULT 'national'");
  db = next;
  return next;
}

function addColumn(database: DatabaseSync, table: string, column: string, definition: string) {
  const cols = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((col) => col.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

export function closeDb() {
  db?.close();
  db = null;
}
