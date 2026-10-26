import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBuy } from "../src/components/product-buy";
import { productShipLine } from "../src/lib/order-facts";
import { POD_COPY_TODO, POD_PLACEHOLDER_IMAGE, podPlaceholder, podShelfItems } from "../src/lib/pod-shelf";
import { UNCONFIRMED_BUTTON, UNCONFIRMED_LABEL } from "../src/lib/shelf-copy";
import { isHeldSample } from "../src/lib/shelf-holds";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-pod-")), "pod.sqlite");
delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
delete process.env.VERCEL_ENV;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

/** Ship times and origin claims stay out of the placeholder and the provider name. */
const BANNED = /\b(usa|u\.s\.a\.?|u\.s\.|united states|ships from|business days?|made in|holiday)\b/i;

const PRICES: Record<string, number> = {
  "pod-white-glossy-mug-11oz": 2199,
  "pod-tapered-tumbler-20oz": 4499,
  "pod-pet-bowl-18oz": 4499,
  "pod-gaming-mouse-pad": 3499,
  "pod-canvas-tote": 2499,
  "pod-pillow-14x14": 3999,
  "pod-ceramic-ornament": 2199,
  "pod-jigsaw-8x10": 3499,
  "pod-enamel-mug-12oz": 2999,
  "pod-tea-towel": 2499,
  "pod-lined-journal": 2499,
  "pod-matte-poster-8x10": 2499,
  "pod-aop-apron": 3999,
  "pod-fleece-blanket-50x60": 4499,
  "pod-weekender-bag": 5999,
  "pod-crew-socks": 2199,
  "pod-canvas-6x6": 3499,
  "pod-laptop-sleeve-13": 3999,
  "pod-water-bottle-17oz": 5499,
  "pod-crossbody-bag": 4499,
  "pod-framed-poster-8x10": 4999,
  "pod-wall-tapestry-26x36": 3999,
};

const LEFT_OUT = [
  "throw blanket",
  "pet bandana",
  "cork coaster",
  "beach towel",
  "kiss-cut",
  "sticky note",
  "can cooler",
  "cutting board",
  "pet leash",
  "pet collar",
  "luggage tag",
  "photo block",
  "backpack",
  "spiral notebook",
  "magnet",
  "drawstring",
  "placemat",
  "bath mat",
  "yoga mat",
  "shower curtain",
  "dad hat",
  "bookmark",
  "doormat",
  "duffle",
];

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
  assert(podShelfItems.length === Object.keys(PRICES).length, "every approved row has one price");
  for (const item of podShelfItems) {
    assert(item.priceCents === PRICES[item.productId], `${item.productId} keeps Dan's price`);
    const copy = podPlaceholder(item.name);
    assert(copy === `${POD_COPY_TODO} ${item.name}`, `${item.productId} is a TODO(copy) placeholder`);
    assert(copy.split(POD_COPY_TODO).length === 2, `${item.productId} has one copy marker`);
    assert(!BANNED.test(item.name), `${item.name} has no ship time or origin claim`);
    assert(!BANNED.test(item.supplierName), `${item.supplierName} has no origin claim`);
    assert(item.supplierName.trim().length > 0, `${item.productId} names its provider`);
  }
  for (const name of LEFT_OUT) {
    assert(
      !podShelfItems.some((item) => item.name.toLowerCase().includes(name)),
      `${name} is not in the approved set`,
    );
  }

  const { ensurePodShelf, podSeedAllowed } = await import("../src/lib/server/pod-shelf");
  assert(podSeedAllowed({ NODE_ENV: "production" }) === false, "production does not seed");
  assert(podSeedAllowed({ VERCEL_ENV: "production" }) === false, "a production deploy does not seed");
  assert(podSeedAllowed({ NODE_ENV: "production", VERCEL_ENV: "preview" }) === true, "a preview boot may seed");
  assert(ensurePodShelf({ NODE_ENV: "production" }) === 0, "a production boot inserts nothing");

  const { createPendingOrder, getListing, publicShopListing } = await import("../src/lib/server/store");
  assert(getListing("pod-white-glossy-mug-11oz") == null, "the production skip left the shelf empty");

  assert(ensurePodShelf({ NODE_ENV: "development" }) === podShelfItems.length, "a dev boot inserts each approved row");
  assert(ensurePodShelf({ NODE_ENV: "development" }) === 0, "a second boot does not insert again");

  for (const item of podShelfItems) {
    const row = getListing(item.productId);
    if (!row) throw new Error(`${item.productId} was not stored`);
    assert(row.supplierUsConfirmed === false, `${item.productId} stays unconfirmed`);
    assert(row.priceCents === item.priceCents, `${item.productId} stored Dan's price`);
    assert(row.title === podPlaceholder(item.name), `${item.productId} title is the placeholder`);
    assert(row.description === podPlaceholder(item.name), `${item.productId} description is the placeholder`);
    assert(row.image === POD_PLACEHOLDER_IMAGE, `${item.productId} uses the existing image placeholder`);
    assert(row.madeInUsa === false, `${item.productId} is not marked made in the US`);
    assert(row.shipsFrom == null && row.deliveryTime == null, `${item.productId} has no ship-from or delivery line`);
    assert(row.supplierOrigin === "", `${item.productId} stores no origin`);
    assert(row.shipDaysMin === 0 && row.shipDaysMax === 0, `${item.productId} stores no ship window`);
    assert(row.published === true && !isHeldSample(row), `${item.productId} is a published product, not a held sample`);
    assert(!/\d/.test(productShipLine(row)), `${item.productId} shopper ship line has no day count`);
    const shown = publicShopListing(row, false);
    assert(!("supplierUsConfirmed" in shown), `${item.productId} public JSON omits the flag`);
    assert(!("shipDaysMin" in shown) && !("shipDaysMax" in shown), `${item.productId} public JSON omits ship days`);
    assert(shown.title === row.title && shown.description === row.description, `${item.productId} public copy is the placeholder`);
    assert(!BANNED.test(shown.description), `${item.productId} public copy has no origin claim`);
  }

  const { getDb } = await import("../src/lib/server/db");
  getDb()
    .prepare("UPDATE listings SET title = ?, supplier_us_confirmed = 1 WHERE product_id = ?")
    .run("Approved mug", "pod-white-glossy-mug-11oz");
  ensurePodShelf({ NODE_ENV: "development" });
  const kept = getListing("pod-white-glossy-mug-11oz");
  assert(kept?.title === "Approved mug" && kept.supplierUsConfirmed === true, "a later title and confirmation stay");

  const blocked = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: {
        productId: "pod-canvas-tote",
        sku: "POD-TOTE",
        title: podPlaceholder("Cotton canvas tote"),
        description: podPlaceholder("Cotton canvas tote"),
        priceCents: 2499,
        image: POD_PLACEHOLDER_IMAGE,
        supplierName: "Printify Choice",
      },
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/pod-canvas-tote",
      unconfirmed: true,
    }),
  );
  assert(blocked.includes(UNCONFIRMED_LABEL), "an unconfirmed POD page shows Coming soon");
  assert(blocked.includes(UNCONFIRMED_BUTTON), "an unconfirmed POD page shows Not available yet");
  assert(blocked.includes('aria-disabled="true"') && blocked.includes("disabled"), "the button is disabled");
  assert(!blocked.includes("Continue to checkout"), "an unconfirmed POD page has no buy button");

  const refused = createPendingOrder({ productId: "pod-canvas-tote", qty: 1, ship });
  assert("error" in refused && refused.error === "That page is not on the store.", "checkout still rejects an unconfirmed POD row");

  console.log("pod shelf checks ok");
}

main();
