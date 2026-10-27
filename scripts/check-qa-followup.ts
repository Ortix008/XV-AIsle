import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBuy } from "../src/components/product-buy";
import { catalogProducts, products } from "../src/lib/catalog";
import { emptyDesk } from "../src/lib/desk-state";
import { applyPass, assess, buildCampaign, buildListing, laneLabel, speedLabel } from "../src/lib/engine";
import { ASSEMBLED_IN_USA_SENTENCE, shopperDescription, withoutAssembledInUsa } from "../src/lib/order-facts";
import { QA_CHECKOUT_PRODUCT_ID } from "../src/lib/qa-checkout";
import { UNCONFIRMED_BUTTON, UNCONFIRMED_LABEL } from "../src/lib/shelf-copy";
import { RESELLER_DAMAGE_NOTE } from "../src/lib/reseller-copy";
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
  assert(waitlistSource.includes("result.ok ? WAITLIST_SAVED"), "the waitlist form shows the approved success line");
  assert(waitlistSource.includes("new FormData"), "the first submit reads the email field");
  assert(waitlistSource.includes("finally"), "a failed first submit clears Sending");
  assert(!waitlistSource.includes("TODO(copy)") && !waitlistSource.includes('"Saved."'), "the waitlist form has no placeholder success line");
  const { submitResellerWaitlist } = await import("../src/lib/waitlist-submit");
  const stalled = await submitResellerWaitlist("first@example.test", (_url, init) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  }, 30);
  assert(stalled.ok === false && stalled.message === "Try again.", "a stalled first submit ends instead of staying on Sending");
  const rejected = await submitResellerWaitlist("first@example.test", async () => {
    throw new Error("network");
  });
  assert(rejected.ok === false && rejected.message === "Try again.", "a rejected first submit ends instead of staying on Sending");
  const accepted = await submitResellerWaitlist("first@example.test", async () => {
    return Response.json({ ok: true });
  });
  assert(accepted.ok === true && accepted.message === WAITLIST_SAVED, "a saved waitlist email uses the approved success line");

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
  assert(RESELLER_DAMAGE_NOTE === "Need a return? Email us your order number within 14 days of delivery.", "the contact line is the approved sentence");
  assert(publicReseller.includes(RESELLER_DAMAGE_NOTE), "the public reseller contact uses the approved damage line");
  assert(publicTerms.includes(RESELLER_DAMAGE_NOTE), "the public reseller terms contact uses the approved damage line");
  assert(!publicReseller.includes("Contact support to start a return."), "the public reseller contact drops the old return line");
  assert(!publicTerms.includes("Contact support to start a return."), "the public reseller terms contact drops the old return line");
  assert(publicReseller.includes("mailto:"), "the public reseller contact already shows the support email");
  assert(operatorReseller.includes("Contact support to start a return."), "an operator still sees the support return line");
  assert(!operatorReseller.includes(RESELLER_DAMAGE_NOTE), "an operator keeps the return-address contact");
  const damageSource = readFileSync(join(process.cwd(), "src/lib/reseller-copy.ts"), "utf8");
  assert(!damageSource.includes("xvaisle.team@gmail.com"), "the damage line does not hardcode a support email");
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

  const banned = /print[-\s]on[-\s]demand|printful|printify/i;
  function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return filesUnder(path);
      return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [path] : [];
    });
  }
  for (const path of filesUnder(join(process.cwd(), "src"))) {
    const source = readFileSync(path, "utf8");
    assert(!banned.test(source), `${path} still names print-on-demand`);
  }
  const day = "2026-10-26";
  let desk = { ...emptyDesk(day), queue: products.map((product) => product.id) };
  const rendered = renderToStaticMarkup(
    createElement(
      Fragment,
      null,
      products.map((product) => {
        const view = assess(product, day);
        const listing = buildListing(product, day);
        desk = applyPass(desk, "scout", day);
        return createElement(
          "article",
          { key: product.id },
          createElement("p", null, product.trend.evidence),
          createElement("p", null, view.reason),
          ...view.pros.map((line) => createElement("p", { key: `${product.id}-pro-${line}` }, line)),
          ...view.cons.map((line) => createElement("p", { key: `${product.id}-con-${line}` }, line)),
          createElement("p", null, listing.description),
          ...view.rows.map((row) => {
            const speed = speedLabel(row.supplier.speed);
            return createElement(
              "p",
              { key: row.supplier.id },
              speed ? createElement("span", null, speed) : null,
              speed ? " · " : null,
              row.supplier.origin,
            );
          }),
          createElement("p", null, desk.log[0]?.text ?? ""),
        );
      }),
    ),
  );
  const visible = rendered.replaceAll("&#x27;", "'").replaceAll("&apos;", "'");
  assert(!banned.test(visible), "operator views still render print-on-demand");
  assert(speedLabel("pod") === "", "a print speed has no label");
  assert(speedLabel("us") === "US stock", "US stock still has its label");
  assert(speedLabel("import") === "Overseas", "an import still has its label");
  const podOrigin = products
    .flatMap((product) => product.suppliers)
    .find((supplier) => supplier.speed === "pod")?.origin;
  const podLine = renderToStaticMarkup(
    createElement("p", null, speedLabel("pod") ? createElement("span", null, speedLabel("pod")) : null, speedLabel("pod") ? " · " : null, podOrigin),
  );
  assert(podLine === `<p>${podOrigin}</p>`, "a print speed does not leave an empty label");
  const apron = products.find((product) => product.id === "apron");
  assert(apron?.trend.evidence === "Plain canvas, two pockets.", "the apron evidence drops the kitchen clause");
  assert(!/walk-in|cooks|after service/i.test(apron?.trend.evidence ?? ""), "the apron evidence has no kitchen or job wording");
  assert(!catalogProducts.some((product) => product.id === "lid-labels" || product.id === "heavy-tee"), "the pod seed items are gone");
  assert(!/Printed in|Prints in|print shop|holding blanks|print-on-demand|\bpod\b/i.test(visible), "operator quotes do not render print text");
  for (const rel of [
    "src/components/desk-shell.tsx",
    "src/components/floor-view.tsx",
    "src/lib/art.ts",
    "README.md",
  ]) {
    const source = readFileSync(join(process.cwd(), rel), "utf8");
    assert(!source.includes("SI Team"), `${rel} no longer says SI Team`);
    assert(source.includes("XV-AIsle Team"), `${rel} says XV-AIsle Team`);
  }
  const shell = readFileSync(join(process.cwd(), "src/components/desk-shell.tsx"), "utf8");
  assert(/tracking-\[0\.12em\][^>]*>\s*XV-AIsle Team\s*</.test(shell), "the desk sidebar says XV-AIsle Team");

  const operatorBan =
    /\b(?:cooks?|cooking|cooked|cooker|chefs?|kitchens?|service|banquet|restaurants?|aprons?)\b|\bwalk-in\b|\bline-cook\b|\bline cook\b|\bafter a double\b|\bline\b|\b(?:preprinted|unprinted|printed|printing|prints|print)\b|print[-\s]on[-\s]demand|printful|printify|\bpod\b|SI Team/i;
  assert(laneLabel("home") === "Home", "a home lane renders as Home");
  assert(
    catalogProducts.every((product) => product.lane !== "kitchen"),
    "the catalog seed does not keep a kitchen lane",
  );
  const seedSource = readFileSync(join(process.cwd(), "src/lib/catalog.ts"), "utf8");
  assert(
    seedSource.includes('title: "After a long day", // COPY-REVIEW'),
    "the new mockup title is marked for copy review",
  );
  const catalogWording = seedSource.replaceAll('speed: "pod"', "");
  assert(
    !/\b(?:preprinted|unprinted|printed|printing|prints|print)\b|print[-\s]on[-\s]demand|printful|printify|SI Team/i.test(catalogWording),
    "the catalog seed has no print or SI Team wording",
  );
  for (const path of filesUnder(join(process.cwd(), "src"))) {
    const source = readFileSync(path, "utf8");
    assert(!source.includes("SI Team"), `${path} still says SI Team`);
  }
  for (const product of catalogProducts) {
    const view = assess(product, day);
    const listing = buildListing(product, day);
    const campaign = buildCampaign(product, listing);
    const text = [
      product.name,
      product.titleLead,
      laneLabel(product.lane),
      product.occasion,
      product.box,
      product.useLine,
      product.colorNote,
      product.hook,
      product.searchPhrase,
      ...product.keywords,
      product.complements,
      product.trend.title,
      product.trend.signal,
      product.trend.evidence,
      ...product.mockups.flatMap((idea) => [idea.title, idea.direction]),
      ...product.suppliers.map((supplier) => supplier.note),
      view.reason,
      ...view.pros,
      ...view.cons,
      ...listing.titles,
      listing.description,
      ...listing.bullets,
      ...listing.tags,
      ...campaign.posts.flatMap((post) => [post.label, post.headline, post.body]),
    ].join("\n");
    const rendered = renderToStaticMarkup(createElement("p", null, text)).replaceAll("&#x27;", "'").replaceAll("&apos;", "'");
    const hit = rendered.match(operatorBan);
    assert(!hit, `${product.id} still renders "${hit?.[0] ?? ""}"`);
  }

  const { returnsPolicyText, RETURNS_POLICY_LINES } = await import("../src/lib/returns-policy");
  const settingsRoute = await import("../src/app/api/store/settings/route");
  const previousSupport = process.env.SUPPORT_EMAIL;
  delete process.env.SUPPORT_EMAIL;
  const missingSupport = await settingsRoute.GET();
  const missingBody = (await missingSupport.json()) as { error?: string; supportEmail?: string; returns?: string };
  assert(missingSupport.status === 500 && missingBody.error === "SUPPORT_EMAIL is unset.", "a blank SUPPORT_EMAIL is refused");
  assert(missingBody.supportEmail == null && missingBody.returns == null, "a missing SUPPORT_EMAIL does not serve blank settings");
  process.env.SUPPORT_EMAIL = "  support@example.test  ";
  const settings = await settingsRoute.GET();
  const settingsBody = (await settings.json()) as { returns?: string; supportEmail?: string };
  assert(settings.status === 200, "settings load when SUPPORT_EMAIL is set");
  assert(settingsBody.supportEmail === "support@example.test", "the support email comes from SUPPORT_EMAIL");
  const approvedReturns = [
    "Returns",
    "You can return an item within 14 days of delivery.",
    "Every item ships from a US supplier or maker, and returns go straight back to them.",
    "To start a return, email us at support@example.test with your order number. We'll email you the address to send it to.",
    "You pay return shipping, unless your item arrived damaged, defective or wrong. Then we cover it.",
    "For a damaged or defective item, email us a photo within 3 days of delivery.",
    "Some suppliers have stricter rules. When they do, a note on that product's page says so.",
  ].join("\n");
  const servedReturns = settingsBody.returns ?? "";
  assert(servedReturns === approvedReturns, "the returns policy matches the approved text");
  assert(returnsPolicyText() === approvedReturns, "the copy module matches the approved text");
  assert(servedReturns === returnsPolicyText(), "settings serves the copy module");
  assert(!servedReturns.includes("{SUPPORT_EMAIL}"), "the returns policy has no unfilled placeholder");
  assert(!RETURNS_POLICY_LINES.join("\n").includes("xvaisle.team@gmail.com"), "the returns policy does not hardcode a support address");
  assert(!servedReturns.includes("xvaisle.team@gmail.com"), "settings do not hardcode a support address");
  const { ReturnsCopy } = await import("../src/app/shop/returns/page");
  const returnsHtml = renderToStaticMarkup(createElement(ReturnsCopy)).replaceAll("&#x27;", "'").replaceAll("&apos;", "'");
  for (const line of approvedReturns.split("\n")) {
    assert(returnsHtml.includes(line), "the returns page renders the approved policy");
  }
  assert(!returnsHtml.includes("{SUPPORT_EMAIL}"), "the returns page has no unfilled placeholder");
  if (previousSupport == null) delete process.env.SUPPORT_EMAIL;
  else process.env.SUPPORT_EMAIL = previousSupport;

  const robots = (await import("../src/app/robots")).default();
  const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
  const disallow = Array.isArray(rule?.disallow) ? rule.disallow : rule?.disallow ? [rule.disallow] : [];
  assert(!disallow.includes("/shop/reseller"), "robots allows the public reseller page");
  for (const path of ["/account", "/desk", "/api", "/scout", "/listings", "/marketing", "/floors", "/catalog", "/membership", "/orders"]) {
    assert(disallow.includes(path), `robots still disallows ${path}`);
  }

  console.log("qa followup checks ok");
}

main();
