import { existsSync } from "node:fs";
import { stderr, stdout } from "node:process";
import { DatabaseSync } from "node:sqlite";
// Node's type stripper requires the .ts extension. tsc does not allow it.
// @ts-expect-error TS5097
import { applyStockCaps, type StockSql } from "../src/lib/stock-caps.ts";

const dbPath = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

function main() {
  if (dbPath !== ":memory:" && !existsSync(dbPath)) fail("No database at DATABASE_PATH.");
  const db = new DatabaseSync(dbPath);
  try {
    const lines = applyStockCaps(db as unknown as StockSql);
    for (const line of lines) stdout.write(`${line}\n`);
  } catch {
    fail("stock caps failed");
  } finally {
    db.close();
  }
}

main();
