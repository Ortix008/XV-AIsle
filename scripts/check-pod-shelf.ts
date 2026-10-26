import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBuy } from "../src/components/product-buy";
import { productShipLine } from "../src/lib/order-facts";
import { POD_COPY_TODO, podPlaceholder, podShelfItems } from "../src/lib/pod-shelf";
import { UNCONFIRMED_BUTTON, UNCONFIRMED_LABEL } from "../src/lib/shelf-copy";
import { isHeldSample } from "../src/lib/shelf-holds";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-pod-")), "pod.sqlite");
delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
delete process.env.VERCEL_ENV;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

/** Ship times and origin claims stay out of the placeholder and the provider name. */
const BANNED = /\b(usa|u\.s\.a\.?|u\.s\.|united states|ships from|business days?|made in)\b/i;

const DRAFT_COPY = ["Your morning coffee", "Journal and Mug Gift Set", "White Glossy Mug, 11oz", "Take your drink along"];

const ship = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};

async function main() {
  const ids = new Set(podShelfItems.map((item) => item.productId));
  assert(ids.size === podShelfItems.length, "product ids are unique");
  assert(podShelfItems.length === 24, "the shelf has exactly 24 print-on-demand items");
  assert(
    !podShelfItems.some((item) => /ceramic/i.test(item.name) || /ceramic/i.test(item.productId)),
    "the ceramic ornament is not on the shelf",
  );
  const bottle = podShelfItems.find((item) => item.name.toLowerCase().includes("bottle"));
  assert(bottle?.name === "Stainless water bottle 18oz", "the bottle is 18oz");
  assert(!podShelfItems.some((item) => /17\s?oz/i.test(item.name)), "no item is named 17oz");

  for (const item of podShelfItems) {
    const copy = podPlaceholder(item.name);
    assert(copy === `${POD_COPY_TODO} ${item.name}`, `${item.productId} is a TODO(copy) placeholder`);
    assert(copy.split(POD_COPY_TODO).length === 2, `${item.productId} has one copy marker`);
    assert(!BANNED.test(item.name), `${item.name} has no ship time or origin claim`);
    assert(!BANNED.test(item.supplierName), `${item.supplierName} has no origin claim`);
    assert(!("priceCents" in item), `${item.productId} does not carry a guessed retail price`);
    for (const line of DRAFT_COPY) {
      assert(!copy.includes(line), `${item.productId} does not use draft copy`);
    }
  }

  const { ensurePodShelf, podSeedAllowed } = await import("../src/lib/server/pod-shelf");
  assert(podSeedAllowed({ NODE_ENV: "production" }) === false, "production does not seed");
  assert(podSeedAllowed({ VERCEL_ENV: "production" }) === false, "a production deploy does not seed");
  assert(podSeedAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" }) === true, "a preview boot may seed");
  assert(ensurePodShelf({ NODE_ENV: "production" }) === 0, "a production boot inserts nothing");

  const { createPendingOrder, getListing, publicShopListing } = await import("../src/lib/server/store");
  const { comingSoonListing } = await import("../src/lib/supplier-confirm");
  assert(getListing("pod-white-glossy-mug-11oz") == null, "the production skip left the shelf empty");

  assert(ensurePodShelf({ NODE_ENV: "development" }) === 24, "a dev boot inserts each approved row");
  assert(ensurePodShelf({ NODE_ENV: "development" }) === 0, "a second boot does not insert again");

  for (const item of podShelfItems) {
    const row = getListing(item.productId);
    if (!row) throw new Error(`${item.productId} was not stored`);
    assert(row.supplierUsConfirmed === false, `${item.productId} stays unconfirmed`);
    assert(comingSoonListing(row) === true, `${item.productId} is Coming soon`);
    assert(row.priceCents === 0, `${item.productId} has no retail price`);
    assert(row.supplierCostCents === (item.costCents ?? 0), `${item.productId} keeps the signed-in cost`);
    assert(row.supplierShippingCents === (item.shippingCents ?? 0), `${item.productId} keeps the signed-in first-item shipping`);
    assert(row.title === podPlaceholder(item.name), `${item.productId} title is the placeholder`);
    assert(row.description === podPlaceholder(item.name), `${item.productId} description is the placeholder`);
    assert(row.image === "", `${item.productId} has no image`);
    assert(row.madeInUsa === false, `${item.productId} is not marked made in the US`);
    assert(row.shipsFrom == null && row.deliveryTime == null, `${item.productId} has no ship-from or delivery line`);
    assert(row.supplierOrigin === "", `${item.productId} stores no origin`);
    assert(row.shipDaysMin === 0 && row.shipDaysMax === 0, `${item.productId} stores no ship window`);
    assert(row.published === true && !isHeldSample(row), `${item.productId} is a published product, not a held sample`);
    assert(!/\d/.test(productShipLine(row)), `${item.productId} shopper ship line has no day count`);
    const shown = publicShopListing(row, false);
    assert(!("supplierUsConfirmed" in shown), `${item.productId} public JSON omits the flag`);
    assert(!("supplierCostCents" in shown) && !("supplierShippingCents" in shown), `${item.productId} public JSON omits cost and shipping`);
    assert(!("shipDaysMin" in shown) && !("shipDaysMax" in shown), `${item.productId} public JSON omits ship days`);
    assert(shown.title === row.title && shown.description === row.description, `${item.productId} public copy is the placeholder`);
    assert(!BANNED.test(shown.description), `${item.productId} public copy has no origin claim`);
    const refused = createPendingOrder({ productId: item.productId, qty: 1, ship });
    assert("error" in refused && refused.error === "That page is not on the store.", `${item.productId} cannot be bought`);
  }

  const blocked = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: {
        productId: "pod-water-bottle-18oz",
        sku: "pod-water-bottle-18oz",
        title: podPlaceholder("Stainless water bottle 18oz"),
        description: podPlaceholder("Stainless water bottle 18oz"),
        priceCents: 0,
        image: "",
        supplierName: "WOYC",
      },
      returnNote: "Contact support to start a return.",
      shareHref: "http://127.0.0.1/shop/pod-water-bottle-18oz",
      unconfirmed: true,
    }),
  );
  assert(blocked.includes(UNCONFIRMED_LABEL), "an unconfirmed POD page shows Coming soon");
  assert(blocked.includes(UNCONFIRMED_BUTTON), "an unconfirmed POD page shows Not available yet");
  assert(blocked.includes('aria-disabled="true"') && blocked.includes("disabled"), "the button is disabled");
  assert(!blocked.includes("Continue to checkout"), "an unconfirmed POD page has no buy button");
  assert(!blocked.includes("$0.00"), "an unknown price is not shown as zero dollars");

  console.log("pod shelf checks ok");
}

main();
