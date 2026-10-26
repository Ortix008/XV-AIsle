import { mkdtempSync, readdirSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBuy } from "../src/components/product-buy";
import { ASSEMBLED_IN_USA_SENTENCE, shopperDescription, withoutAssembledInUsa } from "../src/lib/order-facts";
import { CHECKOUT_OPEN_LIVE, CHECKOUT_OPEN_TEST, checkoutOpenLine } from "../src/lib/checkout-open";
import { SAMPLE_UNAVAILABLE, UNCONFIRMED_BUTTON, UNCONFIRMED_LABEL } from "../src/lib/shelf-copy";
import { requireSupplierConfirmed } from "../src/lib/supplier-confirm";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-nitpick-")), "nitpick.sqlite");
delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_ALLOW_LIVE;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else found.push(path);
  }
  return found;
}

const ship = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};

const listing = {
  productId: "soon-pan",
  sku: "SOON",
  title: "Soon pan",
  description: "A pan.",
  priceCents: 2695,
  image: "",
  supplierName: "Example Seller",
};

async function main() {
  const oldCheckout = ["Checkout opens " + "soon", "When it opens, Stripe will handle " + "your payment"];
  for (const file of walk(join(process.cwd(), "src"))) {
    const text = readFileSync(file, "utf8");
    for (const line of oldCheckout) {
      assert(!text.includes(line), `${file} still has the old checkout line`);
    }
  }

  const home = readFileSync(join(process.cwd(), "src/components/home-screen.tsx"), "utf8");
  const page = readFileSync(join(process.cwd(), "src/app/(home)/page.tsx"), "utf8");
  assert(home.includes("{checkoutLine}"), "the home checkout card prints the approved line");
  assert(page.includes("stripeTestMode()") && page.includes("checkoutOpenLine"), "home uses the Stripe test-mode flag");
  assert(UNCONFIRMED_LABEL === "Coming soon", "the unconfirmed label is the approved string");
  assert(UNCONFIRMED_BUTTON === "Not available yet", "the unconfirmed button is the approved string");

  const { stripeTestMode } = await import("../src/lib/server/stripe");
  const testKey = `${["sk", "test"].join("_")}_nitpick`;
  const liveKey = `${["sk", "live"].join("_")}_nitpick`;
  process.env.STRIPE_SECRET_KEY = testKey;
  assert(stripeTestMode() === true, "a test key is test mode");
  assert(checkoutOpenLine(stripeTestMode()) === CHECKOUT_OPEN_TEST, "test mode uses the test checkout line");
  process.env.STRIPE_SECRET_KEY = liveKey;
  assert(stripeTestMode() === false, "a live key is not test mode");
  assert(checkoutOpenLine(stripeTestMode()) === CHECKOUT_OPEN_LIVE, "live mode uses the live checkout line");
  delete process.env.STRIPE_SECRET_KEY;
  assert(stripeTestMode() === false, "a missing key is not test mode");
  assert(checkoutOpenLine(false) === CHECKOUT_OPEN_LIVE, "live checkout copy stays the short line");

  assert(withoutAssembledInUsa(`Crystal. ${ASSEMBLED_IN_USA_SENTENCE}`) === "Crystal.", "the sentence is deleted");
  assert(withoutAssembledInUsa(ASSEMBLED_IN_USA_SENTENCE) === "", "a description that is only that sentence becomes empty");
  assert(
    shopperDescription(`A heavy pan. ${ASSEMBLED_IN_USA_SENTENCE} Ships from Elizabeth, NJ through Harbor Towel Co.`) ===
      "A heavy pan.",
    "shopper copy drops the sentence and the engine line",
  );

  const held = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/soon-pan",
      held: true,
    }),
  );
  assert(held.includes(SAMPLE_UNAVAILABLE), "a held sample keeps its own label");
  assert(!held.includes(UNCONFIRMED_LABEL), "a held sample does not use the unconfirmed label");

  const blocked = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/soon-pan",
      unconfirmed: true,
    }),
  );
  assert(blocked.includes(UNCONFIRMED_LABEL), "an unconfirmed product shows Coming soon");
  assert(blocked.includes(UNCONFIRMED_BUTTON), "an unconfirmed product shows Not available yet");
  assert(blocked.includes('aria-disabled="true"'), "the unconfirmed button is aria-disabled");
  assert(blocked.includes("disabled"), "the unconfirmed button is disabled");
  assert(blocked.includes('type="button"'), "the unconfirmed control is not a submit button");
  assert(!blocked.includes("Continue to checkout"), "an unconfirmed product has no buy button");
  assert(!blocked.includes("Return address"), "a shopper product page hides the return address");

  const open = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/soon-pan",
      showReturnAddress: true,
    }),
  );
  assert(open.includes("Continue to checkout"), "a confirmed product can still be bought");
  assert(open.includes("Return address"), "an operator product page keeps the return address");

  assert(requireSupplierConfirmed() === true, "the supplier switch defaults on");
  for (const value of ["0", "false", "off", "no"]) {
    assert(requireSupplierConfirmed(value) === false, `${value} turns the switch off`);
  }
  assert(requireSupplierConfirmed("1") === true, "1 keeps the switch on");

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { createPendingOrder, getListing, publicShopListing, publishListing } = await import("../src/lib/server/store");
  const joined = signUp({ name: "Nitpick Seller", email: "nitpick-seller@example.com", password: "nitpick-test" });
  if ("error" in joined) throw new Error(joined.error);
  const pageInput = {
    sku: "NIT",
    title: "Nitpick pan",
    description: "One pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Example Seller",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: joined.account.id,
    supplierCostCents: 500,
  };
  const crystal = publishListing(joined.account.id, {
    ...pageInput,
    productId: "crystal-pan",
    description: `A crystal. ${ASSEMBLED_IN_USA_SENTENCE} It hangs.`,
  });
  if ("error" in crystal || !crystal.listing) throw new Error("error" in crystal ? crystal.error : "crystal");
  assert(getListing("crystal-pan")?.description === "A crystal. It hangs.", "saving a listing deletes the sentence");
  assert(
    !publicShopListing(getListing("crystal-pan")!, false).description.includes(ASSEMBLED_IN_USA_SENTENCE),
    "public catalog copy omits the sentence",
  );
  getDb()
    .prepare("UPDATE listings SET description = ? WHERE product_id = ?")
    .run(ASSEMBLED_IN_USA_SENTENCE, "crystal-pan");
  closeDb();
  assert(getListing("crystal-pan")?.description === "", "opening the store deletes a stored sentence");

  const unconfirmed = publishListing(joined.account.id, { ...pageInput, productId: "open-pan" });
  if ("error" in unconfirmed) throw new Error(unconfirmed.error);
  const confirmed = publishListing(joined.account.id, {
    ...pageInput,
    productId: "ready-pan",
    supplierUsConfirmed: true,
    shipsFrom: "Austin, TX",
  });
  if ("error" in confirmed) throw new Error(confirmed.error);
  const flaggedAbroad = publishListing(joined.account.id, {
    ...pageInput,
    productId: "toronto-pan",
    supplierUsConfirmed: true,
    shipsFrom: "Toronto, ON",
  });
  if ("error" in flaggedAbroad) throw new Error(flaggedAbroad.error);
  delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
  const refused = createPendingOrder({ productId: "open-pan", qty: 1, ship });
  assert("error" in refused && refused.error === "That page is not on the store.", "an unconfirmed product cannot be bought");
  const abroad = createPendingOrder({ productId: "toronto-pan", qty: 1, ship });
  assert("error" in abroad && abroad.error === "That page is not on the store.", "a confirmed product without a US ship-from cannot be bought");
  const allowed = createPendingOrder({ productId: "ready-pan", qty: 1, ship });
  assert(!("error" in allowed), "a confirmed US ship-from can be bought while the switch is on");
  for (const value of ["0", "false", "off", "no"]) {
    process.env.REQUIRE_SUPPLIER_CONFIRMED = value;
    const opened = createPendingOrder({ productId: "open-pan", qty: 1, ship });
    assert(!("error" in opened), `${value} lets an unconfirmed product be bought`);
  }
  process.env.REQUIRE_SUPPLIER_CONFIRMED = "1";
  const refusedAgain = createPendingOrder({ productId: "open-pan", qty: 1, ship });
  assert("error" in refusedAgain && refusedAgain.error === "That page is not on the store.", "1 blocks an unconfirmed product");

  const shown = publicShopListing(getListing("ready-pan")!, false);
  assert(!("supplierUsConfirmed" in shown), "public JSON omits supplierUsConfirmed");
  assert(!("shipDaysMin" in shown) && !("shipDaysMax" in shown), "public JSON omits ship days");

  const checkout = readFileSync(join(process.cwd(), "src/app/api/store/checkout/route.ts"), "utf8");
  const success = checkout.split("attachStripeSession(created.order.id, session.id);")[1]?.split("} catch")[0] ?? "";
  assert(success.includes("return Response.json({ url: session.url })"), "checkout success returns the session url");
  assert(!success.includes("order"), "checkout success does not return an order");

  console.log("nitpick checks ok");
}

main();
