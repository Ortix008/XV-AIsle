import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBuy } from "../src/components/product-buy";
import { ASSEMBLED_IN_USA_SENTENCE, shopperDescription, withoutAssembledInUsa } from "../src/lib/order-facts";
import { QA_CHECKOUT_PRODUCT_ID } from "../src/lib/qa-checkout";
import { UNCONFIRMED_BUTTON, UNCONFIRMED_LABEL } from "../src/lib/shelf-copy";
import { WAITLIST_EMAIL_FORMAT, WAITLIST_SAVED } from "../src/lib/waitlist-copy";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-qa-followup-")), "qa.sqlite");
delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
delete process.env.DEMO_SEED;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
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

const MADE_IN: Array<[string, string]> = [
  [ASSEMBLED_IN_USA_SENTENCE, ""],
  ["designed and assembled in the usa.", ""],
  ["Designed and assembled in the USA!", ""],
  ["Assembled in the USA.", ""],
  ["assembled in the u.s.a.", ""],
  ["Made in USA.", ""],
  ["made in usa!", ""],
  ["MADE IN THE U.S.A.", ""],
  ["Made in the United States.", ""],
  ["Made-in-USA pans.", ""],
  ["Hang it. Made in USA. Throws rainbows.", "Hang it. Throws rainbows."],
  ["A pan. MADE IN CHINA! A lid.", "A pan. A lid."],
  ["Hang it in a window. Throws rainbows.", "Hang it in a window. Throws rainbows."],
];

async function main() {
  for (const [input, expected] of MADE_IN) {
    assert(withoutAssembledInUsa(input) === expected, `made-in cleanup for ${input}`);
    assert(!shopperDescription(input).toLowerCase().includes("made in"), `shopper copy still has a made-in line: ${input}`);
  }
  assert(shopperDescription(`A heavy pan. ${ASSEMBLED_IN_USA_SENTENCE} Ships from Elizabeth, NJ through Harbor Towel Co.`) === "A heavy pan.", "shopper copy still drops the engine ship line");

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { createPendingOrder, getListing, publishListing } = await import("../src/lib/server/store");
  const { comingSoonListing } = await import("../src/lib/supplier-confirm");
  const { signUp } = await import("../src/lib/server/accounts");
  const { joinResellerWaitlist } = await import("../src/lib/server/waitlist");
  const { SITEMAP_PATHS, sitemapListsProduct } = await import("../src/app/sitemap");

  const joined = signUp({ name: "QA Followup", email: "qa-followup@example.com", password: "lane-followup-9" });
  if ("error" in joined) throw new Error(joined.error);
  const stored = publishListing(joined.account.id, {
    productId: "made-pan",
    sku: "MADE",
    title: "Made pan",
    description: "Hang it. Made in USA. Throws rainbows.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Example Seller",
    supplierOrigin: "",
    shipDaysMin: 2,
    shipDaysMax: 4,
  });
  if ("error" in stored) throw new Error(stored.error);
  getDb().prepare("UPDATE listings SET description = ? WHERE product_id = ?").run("A lid. Assembled in the USA. Done.", "made-pan");
  closeDb();
  assert(getListing("made-pan")?.description === "A lid. Done.", "opening the store deletes an assembled-in variant");
  getDb().prepare("UPDATE listings SET description = ? WHERE product_id = ?").run("made in the u.s.a!", "made-pan");
  closeDb();
  assert(getListing("made-pan")?.description === "", "opening the store deletes a lowercase made-in line");

  const page = {
    sku: "QA",
    title: "QA pan",
    description: "One pan.",
    priceCents: 2695,
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Example Seller",
    supplierOrigin: "",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: joined.account.id,
    supplierCostCents: 500,
  };
  const us = publishListing(joined.account.id, { ...page, productId: "us-pan", supplierUsConfirmed: true, shipsFrom: "Austin, TX" });
  const canada = publishListing(joined.account.id, { ...page, productId: "ca-pan", supplierUsConfirmed: true, shipsFrom: "Toronto, ON" });
  const flagOnly = publishListing(joined.account.id, { ...page, productId: "flag-pan", supplierUsConfirmed: true });
  const placeOnly = publishListing(joined.account.id, { ...page, productId: "place-pan", shipsFrom: "Austin, TX" });
  for (const result of [us, canada, flagOnly, placeOnly]) {
    if ("error" in result) throw new Error(result.error);
  }
  delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
  assert(comingSoonListing(getListing("us-pan")!) === false, "a confirmed US ship-from is buyable");
  assert(comingSoonListing(getListing("ca-pan")!) === true, "a confirmed non-US ship-from is Coming soon");
  assert(comingSoonListing(getListing("flag-pan")!) === true, "a confirmed flag without a US ship-from is Coming soon");
  assert(comingSoonListing(getListing("place-pan")!) === true, "a US ship-from without the confirmed flag is Coming soon");
  const bought = createPendingOrder({ productId: "us-pan", qty: 1, ship });
  assert(!("error" in bought), "checkout allows a confirmed US ship-from");
  for (const productId of ["ca-pan", "flag-pan", "place-pan"]) {
    const refused = createPendingOrder({ productId, qty: 1, ship });
    assert("error" in refused && refused.error === "That page is not on the store.", `${productId} stays off checkout`);
  }
  const soon = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: {
        productId: "ca-pan",
        sku: "QA",
        title: "QA pan",
        description: "One pan.",
        priceCents: 2695,
        image: "/art/mock-sheet-pan-1.png",
        supplierName: "Example Seller",
      },
      returnNote: "Contact support to start a return.",
      shareHref: "http://127.0.0.1/shop/ca-pan",
      unconfirmed: comingSoonListing(getListing("ca-pan")!),
    }),
  );
  assert(soon.includes(UNCONFIRMED_LABEL) && soon.includes(UNCONFIRMED_BUTTON), "the product page shows Coming soon without a US ship-from");
  assert(soon.includes("disabled") && soon.includes('aria-disabled="true"'), "the Coming soon button is disabled");
  const open = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: {
        productId: "us-pan",
        sku: "QA",
        title: "QA pan",
        description: "One pan.",
        priceCents: 2695,
        image: "/art/mock-sheet-pan-1.png",
        supplierName: "Example Seller",
      },
      returnNote: "Contact support to start a return.",
      shareHref: "http://127.0.0.1/shop/us-pan",
      unconfirmed: comingSoonListing(getListing("us-pan")!),
    }),
  );
  assert(open.includes("Continue to checkout"), "a confirmed US ship-from keeps the buy button");
  const productPage = readFileSync(join(process.cwd(), "src/app/shop/[productId]/page.tsx"), "utf8");
  assert(productPage.includes("comingSoonListing(listing)"), "the product page uses the US ship-from gate");

  const blank = joinResellerWaitlist("");
  const spaces = joinResellerWaitlist("   ");
  const malformed = joinResellerWaitlist("bad@x");
  const words = joinResellerWaitlist("not-an-email");
  const saved = joinResellerWaitlist("buyer@example.com");
  const approvedFormat = "That email doesn't look right. Check it and try again, like name@example.com.";
  assert("error" in blank && blank.error === "Add an email.", "an empty waitlist email asks for an email");
  assert("error" in spaces && spaces.error === "Add an email.", "a blank waitlist email asks for an email");
  assert("error" in malformed && malformed.error === approvedFormat, "a short email uses the approved format line");
  assert("error" in words && words.error === approvedFormat, "a word email uses the approved format line");
  assert(WAITLIST_EMAIL_FORMAT === approvedFormat, "the format line is the approved sentence");
  assert(!("error" in saved) && saved.ok === true, "a full email joins the waitlist");
  assert(WAITLIST_SAVED === "You're on the waitlist. Thanks for joining!", "the success line is the approved sentence");
  const waitlistSource = readFileSync(join(process.cwd(), "src/components/reseller-waitlist.tsx"), "utf8");
  assert(waitlistSource.includes("response.ok ? WAITLIST_SAVED"), "the waitlist form shows the approved success line");
  assert(!waitlistSource.includes("TODO(copy)") && !waitlistSource.includes('"Saved."'), "the waitlist form has no placeholder success line");

  const { ResellerArticle } = await import("../src/app/shop/reseller/page");
  const { ResellerTermsArticle } = await import("../src/app/shop/reseller/terms/page");
  const publicReseller = renderToStaticMarkup(createElement(ResellerArticle));
  const operatorReseller = renderToStaticMarkup(createElement(ResellerArticle, { operator: true }));
  const publicTerms = renderToStaticMarkup(createElement(ResellerTermsArticle));
  const returnAddressLine = "email the return address when you start a return";
  assert(publicReseller.includes("Email") && publicReseller.includes("Send"), "the public reseller page keeps the waitlist");
  assert(!publicReseller.includes(returnAddressLine), "the public reseller contact block has no return address");
  assert(!publicTerms.includes(returnAddressLine), "the public reseller terms contact block has no return address");
  assert(operatorReseller.includes(returnAddressLine), "an operator still sees the return-address line");
  const resellerSource = readFileSync(join(process.cwd(), "src/app/shop/reseller/page.tsx"), "utf8");
  const termsSource = readFileSync(join(process.cwd(), "src/app/shop/reseller/terms/page.tsx"), "utf8");
  assert(!resellerSource.includes("requireOperator") && resellerSource.includes("viewerIsOperator"), "the reseller page is public");
  assert(!termsSource.includes("requireOperator") && termsSource.includes("viewerIsOperator"), "the reseller terms page is public");
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert(config.includes('source: "/reseller"') && config.includes('destination: "/shop/reseller"'), "/reseller still opens the public reseller page");
  const signup = readFileSync(join(process.cwd(), "src/components/auth-screens.tsx"), "utf8");
  assert(signup.includes('href="/shop/reseller"') && signup.includes("Reseller terms"), "sign-up points Reseller terms at the public reseller page");
  assert(!signup.includes('href="/shop/reseller/terms"'), "sign-up no longer links to the terms path");

  for (const path of ["/shop/order", "/shop/return", "/shop/qa-checkout"]) {
    assert(!SITEMAP_PATHS.includes(path), `${path} is not a sitemap path`);
  }
  const card = {
    supplierName: "Example Seller",
    published: true,
    title: "Pan",
  };
  assert(sitemapListsProduct({ ...card, productId: QA_CHECKOUT_PRODUCT_ID, supplierUsConfirmed: true, shipsFrom: "Austin, TX" }) === false, "the QA fixture stays out of the sitemap");
  assert(sitemapListsProduct({ ...card, productId: "soon-pan", supplierUsConfirmed: false, shipsFrom: "Austin, TX" }) === false, "a Coming soon product stays out of the sitemap");
  assert(sitemapListsProduct({ ...card, productId: "ca-card", supplierUsConfirmed: true, shipsFrom: "Toronto, ON" }) === false, "a non-US confirmed product stays out of the sitemap");
  assert(sitemapListsProduct({ ...card, productId: "us-card", supplierUsConfirmed: true, shipsFrom: "Austin, TX" }) === true, "a confirmed US product stays in the sitemap");
  process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
  assert(sitemapListsProduct({ ...card, productId: "open-card", supplierUsConfirmed: false, shipsFrom: null }) === true, "with the switch off, an unconfirmed product can be listed");
  delete process.env.REQUIRE_SUPPLIER_CONFIRMED;

  console.log("qa followup checks ok");
}

main();
