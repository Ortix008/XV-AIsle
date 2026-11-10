import { getDb } from "../src/lib/server/db";
import { planAisleUpdates, type AisleRow } from "../src/lib/shop-aisle-plan";

const apply = process.argv.includes("--apply");
const rows = getDb().prepare("SELECT product_id, aisle FROM listings").all() as AisleRow[];
const plan = planAisleUpdates(rows);

for (const item of plan) {
  if (item.action === "missing") {
    console.log(`missing  ${item.productId}  would set ${item.aisle}`);
  } else if (item.action === "unchanged") {
    console.log(`kept     ${item.productId}  ${item.aisle}`);
  } else {
    console.log(`update   ${item.productId}  ${item.from ?? "(empty)"} -> ${item.aisle}`);
  }
}

if (!apply) {
  console.log("Dry run only. Pass --apply to write these aisle tags.");
  process.exit(0);
}

const update = getDb().prepare("UPDATE listings SET aisle = ? WHERE product_id = ?");
let wrote = 0;
for (const item of plan) {
  if (item.action !== "update") continue;
  update.run(item.aisle, item.productId);
  wrote += 1;
}
console.log(`Applied ${wrote} aisle tag${wrote === 1 ? "" : "s"}.`);
