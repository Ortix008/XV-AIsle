import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { OrderCard } from "../src/components/order-card";
import { ProductBuy } from "../src/components/product-buy";
import { ShopCardCopy } from "../src/components/shop-grid";
import {
  SHOPPER_PLACE,
  TRACKING_SHIP,
  productShipLine,
  shopperDescription,
} from "../src/lib/order-facts";

const CITY = "Elizabeth, NJ";
const ENGINE_SENTENCE = `Ships from ${CITY} through Harbor Towel Co. Plan on 2–4 days.`;
const RAW_DESCRIPTION = `A heavy pan.\n\n${ENGINE_SENTENCE}`;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function count(text: string, needle: string) {
  return text.split(needle).length - 1;
}

const cleaned = shopperDescription(RAW_DESCRIPTION);
assert(cleaned.includes("A heavy pan."), "the description keeps the product sentence");
assert(cleaned.includes("Plan on 2–4 days."), "the day plan stays after the engine sentence");
assert(!cleaned.includes(CITY) && !cleaned.includes("through Harbor"), "the engine ship sentence is stripped");
assert(
  shopperDescription(`${SHOPPER_PLACE} A pan.`) === `${SHOPPER_PLACE} A pan.`,
  "the approved place line is not an engine sentence",
);
assert(
  shopperDescription(
    "Ships from Shenzhen through Overseas Co. Plan on 12–20 days. This is an import, not a week-of order.",
  ) === "Plan on 12–20 days. This is an import, not a week-of order.",
  "an import engine sentence is stripped and the rest stays",
);

const shopperFiles = [
  "src/components/product-buy.tsx",
  "src/components/shop-grid.tsx",
  "src/components/order-card.tsx",
  "src/lib/server/order-mail.ts",
  "src/lib/server/order-summary.ts",
  "src/app/shop/[productId]/page.tsx",
  "src/app/shop/return/page.tsx",
  "src/app/shop/order/page.tsx",
];
const interpolation =
  /\$\{[^}\n]*\b(?:supplierOrigin|shipsFrom)\b|Ships from \$\{|Ships from \{|\{supplierOrigin\}|\{shipsFrom\}|\{listing\.supplierOrigin|\{listing\.shipsFrom|\{facts\.shipsFrom|\.supplierOrigin\}|\.shipsFrom\}/;
for (const file of shopperFiles) {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  assert(!interpolation.test(source), `${file} interpolates a supplier place`);
  interpolation.lastIndex = 0;
}
const productPage = readFileSync(join(process.cwd(), "src/app/shop/[productId]/page.tsx"), "utf8");
assert(productPage.includes("shown.description"), "share text uses the shopper description");
assert(!productPage.includes("listing.description"), "share text does not use the raw description");
const engine = readFileSync(join(process.cwd(), "src/lib/engine.ts"), "utf8");
assert(
  engine.includes("Ships from ${supplier.origin} through ${supplier.name}."),
  "the desk engine still writes its ship sentence",
);
const store = readFileSync(join(process.cwd(), "src/lib/server/store.ts"), "utf8");
const publicFn = store.slice(store.indexOf("export function publicShopListing"), store.indexOf("function optionalCopy"));
assert(!publicFn.includes("supplierOrigin") && !publicFn.includes("shipsFrom"), "public JSON does not copy a place field");

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-place-")), "place.sqlite");
delete process.env.STRIPE_SECRET_KEY;

async function main() {
  const { publishListing, publicShopListing, getListing } = await import("../src/lib/server/store");
  const { orderSummary } = await import("../src/lib/server/order-summary");
  const { receiptHtml, receiptText } = await import("../src/lib/server/order-mail");
  type StoreOrder = import("../src/lib/server/store").StoreOrder;

  const published = publishListing("acct-place", {
    productId: "place-pan",
    sku: "PAN-P",
    title: "Place pan",
    description: RAW_DESCRIPTION,
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Harbor Towel Co",
    supplierOrigin: CITY,
    shipDaysMin: 2,
    shipDaysMax: 4,
    shipsFrom: CITY,
    supplierUsConfirmed: true,
  });
  if ("error" in published || !published.listing) throw new Error("error" in published ? published.error : "listing");
  const stored = getListing("place-pan");
  assert(stored?.description.includes(`through Harbor Towel Co`), "the desk listing keeps the engine sentence");
  assert(stored?.shipsFrom === CITY && stored.supplierOrigin === CITY, "the desk listing keeps the city");

  const shown = publicShopListing(stored!, false);
  const shownJson = JSON.stringify(shown);
  assert(!("supplierOrigin" in shown) && !("shipsFrom" in shown) && !("origin" in shown), "public JSON has no origin");
  assert(!shownJson.includes(CITY) && !shownJson.includes("through Harbor"), "public JSON has no city and no engine sentence");
  assert(shown.description.includes("Plan on 2–4 days."), "public JSON keeps the day plan");
  assert(productShipLine(shown) === "Our expected window is 2–4 days after you pay.", "a public confirmed listing still has its window");

  const cityListing = {
    productId: "place-pan",
    sku: "PAN-P",
    title: "Place pan",
    description: RAW_DESCRIPTION,
    priceCents: 2695,
    image: "",
    supplierName: "Harbor Towel Co",
    supplierOrigin: CITY,
    shipDaysMin: 2,
    shipDaysMax: 4,
    shipsFrom: CITY,
    supplierUsConfirmed: true as const,
  };
  const product = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: cityListing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/place-pan",
    }),
  );
  assert(!product.includes(CITY) && !product.includes("through Harbor"), "the product page does not render the city or the engine sentence");
  assert(product.includes("A heavy pan.") && product.includes("Plan on 2–4 days."), "the product page keeps the rest of the description");
  assert(count(product, SHOPPER_PLACE) === 1, "the product page shows the place sentence once");
  assert(product.includes("Our expected window is 2–4 days after you pay."), "the product page keeps the window");

  const publicProduct = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: { ...shown, image: "" },
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/place-pan",
    }),
  );
  assert(publicProduct.includes(SHOPPER_PLACE) && publicProduct.includes("Our expected window is 2–4 days after you pay."), "a public listing still shows the place and the window");
  assert(!publicProduct.includes(CITY), "a public listing renders no city");

  const unconfirmedProduct = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: { ...cityListing, supplierUsConfirmed: false },
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/place-pan",
    }),
  );
  assert(!unconfirmedProduct.includes(SHOPPER_PLACE) && !unconfirmedProduct.includes(CITY), "an unconfirmed product page has no place and no city");
  assert(unconfirmedProduct.includes(TRACKING_SHIP), "an unconfirmed product page keeps the tracking line");

  const grid = renderToStaticMarkup(createElement(ShopCardCopy, { listing: cityListing }));
  assert(grid.includes("ships from a US supplier in 2–4 days"), "the grid keeps the confirmed day window");
  assert(!grid.includes(CITY) && !grid.includes(SHOPPER_PLACE), "the grid place is a US supplier, not a city or the full sentence");
  const equalDays = renderToStaticMarkup(
    createElement(ShopCardCopy, { listing: { ...cityListing, shipDaysMin: 3, shipDaysMax: 3 } }),
  );
  assert(equalDays.includes("ships from a US supplier in 3–3 days"), "the grid does not collapse equal days");
  const unconfirmedGrid = renderToStaticMarkup(
    createElement(ShopCardCopy, { listing: { ...cityListing, supplierUsConfirmed: false } }),
  );
  assert(unconfirmedGrid.includes(TRACKING_SHIP) && !unconfirmedGrid.includes(CITY), "an unconfirmed grid card keeps the tracking line and hides the city");

  const card = renderToStaticMarkup(
    createElement(OrderCard, {
      facts: {
        number: "XV-PLACE",
        title: "Place pan",
        qty: 1,
        amountCents: 2695,
        shipsFrom: CITY,
        eta: "Our expected window is 2–4 days after you pay.",
      },
    }),
  );
  assert(card.includes(SHOPPER_PLACE) && !card.includes(CITY), "the order card shows the place sentence and not the city");
  assert(card.includes("Our expected window is 2–4 days after you pay."), "the order card keeps the window");

  const order = {
    number: "XV-PLACE",
    title: "Place pan",
    qty: 1,
    amountCents: 2695,
    productId: "place-pan",
    returnLine1: null,
    returnCity: null,
    returnRegion: null,
    returnPostal: null,
    returnCountry: null,
  } as StoreOrder;
  const summary = orderSummary(order);
  assert(summary.shipsFrom === SHOPPER_PLACE, "the order summary names a US supplier");
  assert(!JSON.stringify(summary).includes(CITY), "the order summary has no city");
  assert(summary.eta === "Our expected window is 2–4 days after you pay.", "the order summary keeps the window");

  const receiptInput = {
    number: "XV-PLACE",
    title: "Place pan",
    qty: 1,
    amountCents: 2695,
    shipsFrom: CITY,
    supplierName: "Harbor Towel Co",
    supplierUsConfirmed: true as const,
    shipDaysMin: 2,
    shipDaysMax: 4,
    receiptUrl: "http://127.0.0.1/shop/order?token=example",
  };
  const text = receiptText(receiptInput);
  const html = receiptHtml(receiptInput);
  assert(text.includes(SHOPPER_PLACE) && html.includes(SHOPPER_PLACE), "the receipt text and HTML name a US supplier");
  assert(!text.includes(CITY) && !html.includes(CITY), "the receipt text and HTML have no city");
  assert(text.includes("Shipping: Our expected window is 2–4 days after you pay."), "the receipt text keeps the window");
  assert(html.includes("Our expected window is 2–4 days after you pay."), "the receipt HTML keeps the window");
  assert(!text.includes("Ships from Ships from") && !html.includes(">Ships from<"), "the receipt does not label the place twice");

  const quiet = receiptText({ ...receiptInput, supplierUsConfirmed: false });
  const quietHtml = receiptHtml({ ...receiptInput, supplierUsConfirmed: false });
  assert(!quiet.includes(SHOPPER_PLACE) && !quiet.includes(CITY), "an unconfirmed receipt text has no place and no city");
  assert(!quietHtml.includes(SHOPPER_PLACE) && !quietHtml.includes(CITY), "an unconfirmed receipt HTML has no place and no city");
  assert(quiet.includes(`Shipping: ${TRACKING_SHIP}`), "an unconfirmed receipt keeps the tracking line");

  console.log("shopper place checks ok");
}

main();
