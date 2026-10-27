import { existsSync } from "node:fs";
import { stderr, stdout } from "node:process";
import { DatabaseSync } from "node:sqlite";
// Node's type stripper requires the .ts extension. tsc does not allow it.
// @ts-expect-error TS5097
import { runStockCaps, type StockSql } from "../src/lib/stock-caps.ts";

const dbPath = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

function main() {
  const apply = process.argv.includes("--apply");
  if (dbPath !== ":memory:" && !existsSync(dbPath)) fail("No database at DATABASE_PATH.");
  const db = new DatabaseSync(dbPath);
  try {
    const result = runStockCaps(db as unknown as StockSql, apply);
    for (const line of result.lines) stdout.write(`${line}\n`);
    if (!result.ok) fail("stock caps failed");
  } catch {
    fail("stock caps failed");
  } finally {
    db.close();
  }
}

main();
