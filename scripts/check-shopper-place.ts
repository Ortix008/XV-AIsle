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

function assertNoShipsFrom(text: string, name: string) {
  assert(!text.includes("Ships from"), `${name} has no Ships from text`);
  assert(!text.includes(SHOPPER_PLACE), `${name} has no place sentence`);
  assert(!text.includes(CITY), `${name} has no city`);
  assert(!text.includes("Our expected window"), `${name} has no window`);
}

function assertOnlyTracking(text: string, name: string) {
  assertNoShipsFrom(text, name);
  assert(text.includes(TRACKING_SHIP), `${name} shows only the tracking line`);
}

const cleaned = shopperDescription(RAW_DESCRIPTION);
assert(cleaned === "A heavy pan.", "the engine ship sentence is cut from the description");
assert(!cleaned.includes("Plan on") && !cleaned.includes(CITY) && !cleaned.includes("through"), "no engine ship remnant stays");
assert(
  shopperDescription(`${SHOPPER_PLACE} A pan.`) === `${SHOPPER_PLACE} A pan.`,
  "the approved place line is not an engine sentence",
);
assert(
  shopperDescription(
    "A pan.\n\nShips from Shenzhen through Overseas Co. Plan on 12–20 days. This is an import, not a week-of order.",
  ) === "A pan.",
  "an import engine sentence is cut entirely",
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
const US_STATE =
  "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR|VI|GU|AS|MP";
const interpolation =
  /\$\{[^}\n]*\b(?:supplierOrigin|shipsFrom)\b|Ships from \$\{|Ships from \{|\{supplierOrigin\}|\{shipsFrom\}|\{listing\.supplierOrigin|\{listing\.shipsFrom|\{facts\.shipsFrom|\.supplierOrigin\}|\.shipsFrom\}/;
const cityPattern = new RegExp(
  String.raw`\b[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+)*,[ \t]*(?:${US_STATE})\b|\$\{[^}\n]*\b(?:supplierOrigin|shipsFrom)\b[^}\n]*\}|\{[^}\n]*\b(?:listing|facts|input)\.(?:supplierOrigin|shipsFrom)\b[^}\n]*\}|Ships from \$\{|ships from \{`,
);
for (const file of shopperFiles) {
  const source = readFileSync(join(process.cwd(), file), "utf8");
  assert(!interpolation.test(source), `${file} interpolates a supplier place`);
  interpolation.lastIndex = 0;
  assert(!cityPattern.test(source), `${file} has a city pattern`);
  cityPattern.lastIndex = 0;
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
  assert(shown.supplierUsConfirmed === true, "public JSON keeps the confirmed flag");
  assert(!shownJson.includes(CITY) && !shownJson.includes("through") && !shownJson.includes("Plan on"), "public JSON has no city and no engine sentence");
  assert(shown.description === "A heavy pan.", "public JSON cuts the engine sentence");
  assert(productShipLine(stored!) === "Our expected window is 2–4 days after you pay.", "a confirmed listing still has its window");

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
  assert(!product.includes(CITY) && !product.includes("through") && !product.includes("Plan on"), "the product page does not render the city or the engine sentence");
  assert(product.includes("A heavy pan."), "the product page keeps the rest of the description");
  assert(count(product, SHOPPER_PLACE) === 1, "the confirmed product page shows the place sentence once");
  assert(product.includes("Our expected window is 2–4 days after you pay."), "the confirmed product page keeps the window");

  const publicProduct = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: { ...shown, image: "" },
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/place-pan",
      shipWindow: productShipLine(stored!),
    }),
  );
  assert(publicProduct.includes(SHOPPER_PLACE) && publicProduct.includes("Our expected window is 2–4 days after you pay."), "a public confirmed listing shows the place and the window");
  assert(!publicProduct.includes(CITY) && !publicProduct.includes("Plan on"), "a public listing renders no city and no engine sentence");

  const unconfirmedProduct = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: { ...cityListing, supplierUsConfirmed: false },
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/place-pan",
    }),
  );
  assert(!unconfirmedProduct.includes(SHOPPER_PLACE) && !unconfirmedProduct.includes("Ships from"), "an unconfirmed product page has no ships-from line");
  assert(!unconfirmedProduct.includes(CITY) && !unconfirmedProduct.includes("Our expected window"), "an unconfirmed product page has no city and no window");
  assert(unconfirmedProduct.includes(TRACKING_SHIP), "an unconfirmed product page shows only the tracking line");

  const grid = renderToStaticMarkup(createElement(ShopCardCopy, { listing: cityListing }));
  assert(grid.includes(SHOPPER_PLACE), "a confirmed grid card shows the place sentence");
  assert(!grid.includes(CITY) && !grid.includes("2–4") && !grid.includes("days"), "a confirmed grid card has no city and no day window");
  const unconfirmedGrid = renderToStaticMarkup(
    createElement(ShopCardCopy, { listing: { ...cityListing, supplierUsConfirmed: false } }),
  );
  assert(unconfirmedGrid.includes(TRACKING_SHIP), "an unconfirmed grid card shows the tracking line");
  assert(!unconfirmedGrid.includes(SHOPPER_PLACE) && !unconfirmedGrid.includes("Ships from") && !unconfirmedGrid.includes(CITY), "an unconfirmed grid card has no ships-from line and no city");
  assert(!unconfirmedGrid.includes("2–4") && !unconfirmedGrid.includes("days"), "an unconfirmed grid card has no day window");

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
  assert(card.includes(SHOPPER_PLACE) && !card.includes(CITY), "the confirmed order card shows the place sentence and not the city");
  assert(card.includes("Our expected window is 2–4 days after you pay."), "the confirmed order card keeps the window");
  const quietCard = renderToStaticMarkup(
    createElement(OrderCard, {
      facts: {
        number: "XV-QUIET",
        title: "Quiet pan",
        qty: 1,
        amountCents: 2695,
        shipsFrom: null,
        eta: TRACKING_SHIP,
      },
    }),
  );
  assert(quietCard.includes(TRACKING_SHIP), "an unconfirmed order card shows the tracking line");
  assert(!quietCard.includes(SHOPPER_PLACE) && !quietCard.includes("Ships from") && !quietCard.includes(CITY), "an unconfirmed order card has no ships-from line");
  assert(!quietCard.includes("Our expected window"), "an unconfirmed order card has no window");

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
  assert(summary.eta === "Our expected window is 2–4 days after you pay.", "the confirmed order summary keeps the window");

  const quietPublished = publishListing("acct-place", {
    productId: "quiet-pan",
    sku: "PAN-Q",
    title: "Quiet pan",
    description: RAW_DESCRIPTION,
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Harbor Towel Co",
    supplierOrigin: CITY,
    shipDaysMin: 2,
    shipDaysMax: 4,
    shipsFrom: CITY,
    supplierUsConfirmed: false,
  });
  if ("error" in quietPublished || !quietPublished.listing) throw new Error("error" in quietPublished ? quietPublished.error : "quiet listing");
  const quietShown = publicShopListing(quietPublished.listing, false);
  assert(quietShown.supplierUsConfirmed === false, "an unconfirmed public listing keeps the flag off");
  assert(!("supplierOrigin" in quietShown) && !("shipsFrom" in quietShown) && !("origin" in quietShown), "an unconfirmed public listing has no origin");
  const quietJson = JSON.stringify(quietShown);
  assert(!quietJson.includes(CITY) && quietShown.description === "A heavy pan.", "an unconfirmed public listing has no city and no engine sentence");
  assertNoShipsFrom(quietJson, "an unconfirmed public product JSON");
  assert(!quietJson.includes("supplierOrigin") && !quietJson.includes("shipsFrom") && !quietJson.includes('"origin"'), "an unconfirmed public product JSON has no place field");

  const quietWindow = productShipLine(quietPublished.listing);
  assert(quietWindow === TRACKING_SHIP, "an unconfirmed product window is the tracking line");
  const quietReturnNote = "We'll email the return address when you start a return.";
  const quietShare = "http://127.0.0.1/shop/quiet-pan";
  const quietMarkup = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: { ...quietShown, image: "" },
      returnNote: quietReturnNote,
      shareHref: quietShare,
      shipWindow: quietWindow,
    }),
  );
  const quietProps = {
    listing: quietShown,
    returnNote: quietReturnNote,
    shareHref: quietShare,
    shipWindow: quietWindow,
  };
  const metadataDescription = `$26.95. ${quietShown.description}`.slice(0, 200);
  const pageSource = `${quietMarkup}\n${JSON.stringify(quietProps)}\n${JSON.stringify({ listing: quietShown })}\n${metadataDescription}`;
  assertOnlyTracking(quietMarkup, "an unconfirmed product page HTML");
  assertOnlyTracking(pageSource, "an unconfirmed product page source");

  const quietGrid = renderToStaticMarkup(createElement(ShopCardCopy, { listing: quietShown }));
  const gridSource = `${quietGrid}\n${JSON.stringify({ listings: [quietShown] })}`;
  assertOnlyTracking(quietGrid, "an unconfirmed shop grid");
  assertOnlyTracking(gridSource, "an unconfirmed shop grid source");

  const quietSummary = orderSummary({ ...order, productId: "quiet-pan", number: "XV-QUIET", title: "Quiet pan" });
  assert(quietSummary.shipsFrom === null, "an unconfirmed order summary has no ships-from line");
  assert(quietSummary.eta === TRACKING_SHIP, "an unconfirmed order summary with ship days stays on the tracking line");
  assert(!JSON.stringify(quietSummary).includes(CITY) && !JSON.stringify(quietSummary).includes("Our expected window"), "an unconfirmed order summary has no city and no window");
  const summaryCard = renderToStaticMarkup(createElement(OrderCard, { facts: quietSummary }));
  const orderSource = `${summaryCard}\n${JSON.stringify(quietSummary)}`;
  assertOnlyTracking(summaryCard, "an unconfirmed order card");
  assertOnlyTracking(orderSource, "an unconfirmed order card source");
  assertNoShipsFrom(JSON.stringify(quietSummary), "an unconfirmed order summary JSON");

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
  assert(!quiet.includes("Ships from") && !quiet.includes(CITY) && !quiet.includes("Our expected window"), "an unconfirmed receipt text has no ships-from line, city, or window");
  assert(!quietHtml.includes("Ships from") && !quietHtml.includes(CITY) && !quietHtml.includes("Our expected window"), "an unconfirmed receipt HTML has no ships-from line, city, or window");
  assert(quiet.includes(`Shipping: ${TRACKING_SHIP}`) && quietHtml.includes(TRACKING_SHIP), "an unconfirmed receipt shows only the tracking line");
  assertOnlyTracking(quiet, "an unconfirmed receipt text");
  assertOnlyTracking(quietHtml, "an unconfirmed receipt HTML");

  console.log("shopper place checks ok");
}

main();
