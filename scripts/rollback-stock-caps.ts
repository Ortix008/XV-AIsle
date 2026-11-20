import { existsSync, readFileSync } from "node:fs";
import { stderr, stdout } from "node:process";
import { DatabaseSync } from "node:sqlite";
// Node's type stripper requires the .ts extension. tsc does not allow it.
// @ts-expect-error TS5097
import { rollbackStockCaps, stockCapPlanFromJson, type StockSql } from "../src/lib/stock-caps.ts";

const dbPath = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

function loadPlan() {
  const path = "scripts/stock-caps.json";
  if (!existsSync(path)) fail("No stock cap plan at scripts/stock-caps.json.");
  try {
    return stockCapPlanFromJson(readFileSync(path, "utf8"));
  } catch {
    fail("stock cap rollback failed");
  }
}

function main() {
  const plan = loadPlan();
  if (dbPath !== ":memory:" && !existsSync(dbPath)) fail("No database at DATABASE_PATH.");
  const db = new DatabaseSync(dbPath);
  try {
    const lines = rollbackStockCaps(db as unknown as StockSql, plan);
    for (const line of lines) stdout.write(`${line}\n`);
  } catch {
    fail("stock cap rollback failed");
  } finally {
    db.close();
  }
}

main();
