import { getDb } from "../src/lib/server/db";
import { planAisleUpdates, type AisleRow } from "../src/lib/shop-aisle-plan";

const apply = process.argv.includes("--apply");
const rows = getDb().prepare("SELECT product_id, aisle FROM listings").all() as AisleRow[];
const plan = planAisleUpdates(rows);
let matched = 0;

console.log("Matching listings.product_id, the public product id.");
for (const item of plan) {
  const found = item.action !== "missing";
  if (found) matched += 1;
  if (!found) {
    console.log(`${item.productId}  matched no`);
  } else if (item.action === "unchanged") {
    console.log(`${item.productId}  matched yes  ${item.aisle}`);
  } else {
    console.log(`${item.productId}  matched yes  ${item.from ?? "(empty)"} -> ${item.aisle}`);
  }
}
console.log(`matched ${matched} of ${plan.length}`);

if (!apply) {
  console.log("Dry run only. Pass --apply to write these aisle tags.");
  process.exit(matched === plan.length ? 0 : 1);
}

if (matched !== plan.length) {
  console.log("Nothing was written. Every mapped product id has to match a row first.");
  process.exit(1);
}

const update = getDb().prepare("UPDATE listings SET aisle = ? WHERE product_id = ?");
let wrote = 0;
for (const item of plan) {
  if (item.action !== "update") continue;
  update.run(item.aisle, item.productId);
  wrote += 1;
}
console.log(`Applied ${wrote} aisle tag${wrote === 1 ? "" : "s"}.`);
