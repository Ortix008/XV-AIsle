import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function parseCount(value) {
  if (value === null) return { stockCount: null };
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return { stockCount: value };
  return null;
}

function parseCliCount(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null;
  return parseCount(Number(value));
}

function readFileCounts(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const counts = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object" || typeof item.sku !== "string" || !item.sku.trim()) return null;
      const count = parseCount(item.stock_count);
      if (!count) return null;
      counts.push({ sku: item.sku.trim(), stockCount: count.stockCount });
    }
    return counts;
  } catch {
    return null;
  }
}

function args() {
  const argv = process.argv.slice(2);
  let file = "";
  let sku = "";
  let count = "";
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") file = argv[++i] ?? "";
    else if (arg === "--sku") sku = argv[++i] ?? "";
    else if (arg === "--count") count = argv[++i] ?? "";
    else return null;
  }
  if (file && !sku && !count) {
    const counts = readFileCounts(file);
    return counts ? { counts } : null;
  }
  if (!file && sku && count) {
    const parsed = parseCliCount(count);
    if (!parsed) return null;
    return { counts: [{ sku, stockCount: parsed.stockCount }] };
  }
  return null;
}

function offersOf(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item && typeof item.sku === "string").map((item) => item.sku);
  } catch {
    return [];
  }
}

function findListing(db, sku) {
  const columns = db.prepare("PRAGMA table_info(listings)").all();
  const hasOffer = columns.some((column) => column.name === "size_offer");
  const rows = db.prepare(`SELECT product_id, sku${hasOffer ? ", size_offer" : ""} FROM listings`).all();
  const hits = [];
  for (const row of rows) {
    if (row.sku === sku || offersOf(row.size_offer).includes(sku)) hits.push(row.product_id);
  }
  return hits;
}

function main() {
  const email = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase() ?? "";
  if (!email) {
    fail("Set STORE_OPERATOR_EMAIL.");
    return;
  }
  const parsed = args();
  if (!parsed) {
    fail("Pass --sku and --count, or --file.");
    return;
  }
  const path = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";
  let db;
  try {
    db = new DatabaseSync(path, { timeout: 5000 });
  } catch {
    fail("The store database could not be opened.");
    return;
  }
  db.exec("PRAGMA busy_timeout = 5000;");
  const operator = db.prepare("SELECT role FROM accounts WHERE email = ?").get(email);
  if (!operator || operator.role !== "admin") {
    fail("Only an operator can set stock.");
    db.close();
    return;
  }
  db.exec(`CREATE TABLE IF NOT EXISTS listing_stock (
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    stock_count INTEGER,
    PRIMARY KEY (product_id, sku)
  )`);
  const located = [];
  for (const count of parsed.counts) {
    const hits = findListing(db, count.sku);
    if (hits.length !== 1) {
      fail("That sku is not on a listing.");
      db.close();
      return;
    }
    located.push({ ...count, productId: hits[0] });
  }
  const write = db.prepare(
    `INSERT INTO listing_stock (product_id, sku, stock_count) VALUES (?, ?, ?)
     ON CONFLICT(product_id, sku) DO UPDATE SET stock_count = excluded.stock_count`,
  );
  const cap = db.prepare("UPDATE listings SET stock_cap = 1 WHERE product_id = ?");
  const sync = db.prepare(
    `UPDATE listings
     SET stock_count = (
       SELECT stock_count FROM listing_stock
       WHERE product_id = listings.product_id AND sku = listings.sku
     )
     WHERE product_id = ?`,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const count of located) {
      write.run(count.productId, count.sku, count.stockCount);
      cap.run(count.productId);
      sync.run(count.productId);
    }
    db.exec("COMMIT");
  } catch {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    fail("The stock was not written.");
    db.close();
    return;
  }
  for (const count of located) {
    process.stdout.write(`${count.sku} → ${count.stockCount}\n`);
  }
  db.close();
}

main();
