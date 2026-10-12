import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  compareAtRejection,
  deliveryExceedsWindow,
  DELIVERY_WARN_BUSINESS_DAYS,
  REPLY_WITHIN_HOURS,
} from "../src/lib/honest-price";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

assert(compareAtRejection({ compareAtPrice: 1999 }) !== null, "compare-at price is rejected");
assert(compareAtRejection({ compare_at_price_cents: 100 }) !== null, "snake-case compare-at is rejected");
assert(compareAtRejection({ strikePrice: 20 }) !== null, "strike price is rejected");
assert(compareAtRejection({ description: "Was $40, now $20" }) !== null, "was-price copy is rejected");
assert(compareAtRejection({ description: "The price is <s>$40</s> $20" }) !== null, "strike tag is rejected");
assert(compareAtRejection({ description: "One pan. The price is the price." }) === null, "a plain price is allowed");
assert(compareAtRejection({ priceCents: 2695 }) === null, "the selling price is allowed");

assert(!deliveryExceedsWindow({ shipDaysMax: DELIVERY_WARN_BUSINESS_DAYS, deliveryTime: "2–4 business days" }), "7 business days is the line");
assert(deliveryExceedsWindow({ shipDaysMax: 8 }), "8 days warns");
assert(deliveryExceedsWindow({ deliveryTime: "10–14 days" }), "a long written window warns");
assert(REPLY_WITHIN_HOURS === 24, "a person replies within 24 hours");

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-honest-")), "honest.sqlite");

async function main() {
  const { publishListing, publicShopListing, saveListingCheck, getListing } = await import("../src/lib/server/store");

  const published = publishListing("acct-honest", {
    productId: "honest-pan",
    sku: "PAN-H",
    title: "Honest pan",
    description: "One pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "North Mill",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    brand: "North Mill",
    whyItCosts: "The steel is thick enough to sit in a hot oven.",
  });
  if ("error" in published || !published.listing) throw new Error("listing");
  const hidden = publicShopListing(published.listing, false);
  assert(!("checkedBy" in hidden), "an empty check stays off the public listing");
  assert(!("whyWePicked" in hidden), "an empty earned-place line stays off the public listing");
  assert(hidden.brand === "North Mill", "brand is public when set");
  assert(hidden.whyItCosts === "The steel is thick enough to sit in a hot oven.", "the cost line is public when set");

  const saved = saveListingCheck("honest-pan", {
    checkedBy: "XV desk",
    checkedOn: "2026-10-12",
    checkedNote: "The page matches the pan we received.",
  });
  if ("error" in saved) throw new Error(saved.error);
  const shown = publicShopListing(getListing("honest-pan")!, false);
  assert(shown.checkedBy === "XV desk" && shown.checkedOn === "2026-10-12", "a finished check is public");
  assert(shown.checkedNote === "The page matches the pan we received.", "the check note is public");

  const earned = publishListing("acct-honest", {
    productId: "honest-pan",
    sku: "PAN-H",
    title: "Honest pan",
    description: "One pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "North Mill",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    whyWePicked: "The pan is one piece of steel, and the page says so.",
  });
  if ("error" in earned || !earned.listing) throw new Error("earned");
  const withPlace = publicShopListing(getListing("honest-pan")!, false);
  assert(
    withPlace.whyWePicked === "The pan is one piece of steel, and the page says so.",
    "the earned-place line is public when set",
  );
  assert(withPlace.checkedBy === "XV desk", "writing the earned-place line keeps the check");

  const struck = publishListing("acct-honest", {
    productId: "struck-pan",
    sku: "PAN-S",
    title: "Struck pan",
    description: "Was $40, now the same pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "North Mill",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
  });
  assert("error" in struck, "a struck price cannot be published");

  const partial = saveListingCheck("honest-pan", { checkedBy: "XV desk", checkedOn: "", checkedNote: "" });
  assert("error" in partial, "a check needs a name, a date, and a note");

  const cleared = saveListingCheck("honest-pan", { checkedBy: "", checkedOn: "", checkedNote: "" });
  if ("error" in cleared) throw new Error(cleared.error);
  const afterClear = publicShopListing(getListing("honest-pan")!, false);
  assert(!("checkedBy" in afterClear), "clearing a check hides it again");

  console.log("honest price checks ok");
}

main();
