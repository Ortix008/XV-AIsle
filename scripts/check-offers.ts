import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sourcedOfferInputs } from "../src/data/sourced-offers";
import { ProductBuy } from "../src/components/product-buy";
import { SourcedOfferList } from "../src/components/sourced-offer-shelf";
import {
  AFFILIATE_CHECKOUT_BLOCK,
  acceptSourcedOffers,
  presentSourcedOffer,
  replaceSourcedOffersForTests,
  resetSourcedOffersForTests,
  shopperOfferState,
  stripeCheckoutBlock,
  UNVERIFIED_OFFER_LABEL,
} from "../src/lib/offer-sale";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-offers-")), "offers.sqlite");
delete process.env.REQUIRE_SUPPLIER_CONFIRMED;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.DEMO_SEED;
delete process.env.STRIPE_ALLOW_LIVE;

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

const listing = {
  productId: "candidate-clip",
  sku: "CLIP",
  title: "Clip",
  description: "A clip.",
  priceCents: 2099,
  image: "",
  supplierName: "Example Seller",
};

async function main() {
  assert(sourcedOfferInputs.length === 0, "no sourced offer is committed yet");
  assert(
    UNVERIFIED_OFFER_LABEL === "Supplier terms unverified — not available to purchase",
    "the unverified label is the required sentence",
  );
  assert(stripeCheckoutBlock("sheet-pan") === null, "an ordinary id is left to the existing checkout gates");

  const dropped = acceptSourcedOffers([
    { id: "Bad Id", title: "Nope", status: "unverified" },
    { id: "scented-candle", title: "Scented candle", status: "unverified" },
    { id: "pet-brand-lead", title: "Pet brush", status: "unverified" },
    { id: "food-lead", title: "Snack tin", status: "unverified", category: "food" },
    { id: "print-lead", title: "Blank tee", status: "unverified", category: ["print", "on", "demand"].join("-") },
    { id: "remote-photo", title: "Remote photo", status: "unverified", image: "https://example.invalid/a.jpg" },
    {
      id: "promised",
      title: "Promised clip",
      status: "unverified",
      note: "Ships in 2 days. Free returns.",
    },
    {
      id: "http-link",
      title: "Http link",
      status: "affiliate",
      affiliateApproved: true,
      affiliateHref: "http://example.invalid/offer",
    },
    {
      id: "unapproved-link",
      title: "Unapproved link",
      status: "affiliate",
      affiliateApproved: false,
      affiliateHref: "https://example.invalid/offer",
    },
    { id: "candidate-clip", title: "Clip", status: "unverified", note: "A metal clip from the source sheet." },
    { id: "candidate-clip", title: "Duplicate", status: "unverified" },
  ]);
  assert(dropped.some((offer) => offer.id === "remote-photo" && offer.image === null), "a remote image is not kept");
  assert(dropped.some((offer) => offer.id === "promised" && offer.note === null), "a shipping promise is not kept as a note");
  assert(!dropped.some((offer) => offer.id === "scented-candle"), "a candle title is not accepted");
  assert(!dropped.some((offer) => offer.id === "pet-brand-lead"), "a pet title is not accepted");
  assert(!dropped.some((offer) => offer.id === "food-lead"), "a food category is not accepted");
  assert(!dropped.some((offer) => offer.id === "print-lead"), "a print-on-demand category is not accepted");
  assert(dropped.filter((offer) => offer.id === "candidate-clip").length === 1, "a duplicate id is dropped");
  const httpLink = dropped.find((offer) => offer.id === "http-link");
  const unapproved = dropped.find((offer) => offer.id === "unapproved-link");
  assert(httpLink?.affiliateHref === null && unapproved?.affiliateHref === null, "an affiliate link needs approval and https");
  assert(presentSourcedOffer(httpLink!, false).label === UNVERIFIED_OFFER_LABEL, "a bad affiliate link stays unverified");
  const shown = presentSourcedOffer(dropped.find((offer) => offer.id === "candidate-clip")!, false);
  assert(shown.kind === "unverified" && shown.href === null && shown.label === UNVERIFIED_OFFER_LABEL, "an unverified record has the label and no link");
  assert(!("priceCents" in shown), "an unverified record has no price");

  const affiliate = acceptSourcedOffers([
    {
      id: "approved-link",
      title: "Approved link",
      status: "affiliate",
      affiliateApproved: true,
      affiliateHref: "https://supplier.example/offer",
    },
  ])[0];
  const affiliateCard = presentSourcedOffer(affiliate!, false);
  assert(affiliateCard.kind === "affiliate" && affiliateCard.href === "https://supplier.example/offer" && affiliateCard.label === null, "an approved https link is the purchase route");
  assert(stripeCheckoutBlock("approved-link", [affiliate!]) === AFFILIATE_CHECKOUT_BLOCK, "affiliate checkout stays off this store");

  const fulfillment = acceptSourcedOffers([
    { id: "ready-note", title: "Ready note", status: "fulfillment", listingId: "ready-pan" },
  ])[0]!;
  assert(presentSourcedOffer(fulfillment, false).label === UNVERIFIED_OFFER_LABEL, "a fulfillment note without a sellable listing stays unverified");
  assert(presentSourcedOffer(fulfillment, true).href === "/shop/ready-pan", "a sellable fulfillment listing can be opened");
  assert(stripeCheckoutBlock("ready-note", [fulfillment]) === UNVERIFIED_OFFER_LABEL, "the note id itself cannot be checked out");
  assert(stripeCheckoutBlock("ready-pan", [fulfillment]) === null, "the listing id stays on the existing checkout gates");
  assert(shopperOfferState("ready-pan", false, [fulfillment]).mode === "unverified", "an unsellable fulfillment listing is not a store offer");
  assert(shopperOfferState("ready-pan", true, [fulfillment]).mode === "store", "a sellable fulfillment listing uses the store checkout");

  const unverifiedMarkup = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "hidden",
      shareHref: "http://127.0.0.1/shop/candidate-clip",
      termsUnverified: true,
    }),
  );
  assert(unverifiedMarkup.includes(UNVERIFIED_OFFER_LABEL), "the product page shows the unverified sentence");
  assert(!unverifiedMarkup.includes("Continue to checkout"), "an unverified product has no checkout button");
  assert(!unverifiedMarkup.includes("Tracking emailed"), "an unverified product makes no shipping promise");
  assert(!unverifiedMarkup.includes("You can start a return"), "an unverified product makes no return promise");
  assert(!unverifiedMarkup.includes("product-price"), "an unverified product does not show a shelf price");

  const affiliateMarkup = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "hidden",
      shareHref: "http://127.0.0.1/shop/candidate-clip",
      externalOfferHref: "https://supplier.example/offer",
    }),
  );
  assert(affiliateMarkup.includes("Open the approved offer"), "an approved affiliate offer shows its link");
  assert(affiliateMarkup.includes('href="https://supplier.example/offer"'), "the affiliate link is the approved url");
  assert(!affiliateMarkup.includes("Continue to checkout"), "an affiliate offer does not open Stripe checkout");

  const shelf = renderToStaticMarkup(
    createElement(SourcedOfferList, {
      offers: [shown, affiliateCard],
    }),
  );
  assert(shelf.includes(UNVERIFIED_OFFER_LABEL) && shelf.includes("Open the approved offer"), "the sourcing shelf shows both kinds");
  assert(renderToStaticMarkup(createElement(SourcedOfferList, { offers: [] })) === "", "an empty shelf renders nothing");

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { createPendingOrder, publishListing } = await import("../src/lib/server/store");
  const { GET: offersGet } = await import("../src/app/api/store/offers/route");
  const { GET: catalogGet } = await import("../src/app/api/store/catalog/route");
  const { POST: cartPost } = await import("../src/app/api/store/cart/route");
  const { POST: checkoutPost } = await import("../src/app/api/store/checkout/route");

  const emptyOffers = (await (await offersGet()).json()) as { offers: unknown[] };
  assert(emptyOffers.offers.length === 0, "the public offer route is empty until records exist");

  const joined = signUp({ name: "Offer Seller", email: "offer-seller@example.com", password: "offer-test" });
  if ("error" in joined) throw new Error(joined.error);
  const pageInput = {
    sku: "OFF",
    title: "Offer pan",
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
  const unconfirmed = publishListing(joined.account.id, { ...pageInput, productId: "open-offer" });
  if ("error" in unconfirmed) throw new Error(unconfirmed.error);
  const confirmed = publishListing(joined.account.id, {
    ...pageInput,
    productId: "ready-pan",
    supplierUsConfirmed: true,
    shipsFrom: "Austin, TX",
  });
  if ("error" in confirmed) throw new Error(confirmed.error);

  const catalog = (await (await catalogGet()).json()) as {
    products: { id: string; availability: string; purchasable: boolean }[];
  };
  const openCard = catalog.products.find((item) => item.id === "open-offer");
  const readyCard = catalog.products.find((item) => item.id === "ready-pan");
  assert(openCard?.availability === "unavailable" && openCard.purchasable === false, "an unconfirmed listing is not in stock");
  assert(readyCard?.availability === "in stock" && readyCard.purchasable === true, "a confirmed listing stays purchasable");

  const bought = createPendingOrder({ productId: "ready-pan", qty: 1, ship });
  if ("error" in bought) throw new Error(bought.error);

  replaceSourcedOffersForTests([
    { id: "candidate-clip", title: "Clip", status: "unverified", note: "A metal clip from the source sheet." },
    { id: "tied-note", title: "Tied note", status: "unverified", listingId: "ready-pan" },
    {
      id: "approved-link",
      title: "Approved link",
      status: "affiliate",
      affiliateApproved: true,
      affiliateHref: "https://supplier.example/offer",
    },
  ]);
  try {
    const ordersBefore = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
    const refused = createPendingOrder({ productId: "candidate-clip", qty: 1, ship });
    assert("error" in refused && refused.error === UNVERIFIED_OFFER_LABEL, "checkout refuses an unverified candidate");
    const tied = createPendingOrder({ productId: "ready-pan", qty: 1, ship });
    assert("error" in tied && tied.error === UNVERIFIED_OFFER_LABEL, "a candidate tied to a listing cannot be checked out");
    const affiliateOrder = createPendingOrder({ productId: "approved-link", qty: 1, ship });
    assert("error" in affiliateOrder && affiliateOrder.error === AFFILIATE_CHECKOUT_BLOCK, "an affiliate offer does not create a store order");
    const ordersAfter = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
    assert(ordersAfter === ordersBefore, "a refused offer does not write an order");

    const cart = await cartPost(
      new Request("http://127.0.0.1/api/store/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: "candidate-clip", qty: 1 }),
      }),
    );
    const cartBody = (await cart.json()) as { error?: string };
    assert(cart.status === 400 && cartBody.error === UNVERIFIED_OFFER_LABEL, "the cart refuses an unverified candidate");

    process.env.STRIPE_SECRET_KEY = "sk_test_offers";
    let stripeCalled = false;
    const { setStripeFetch } = await import("../src/lib/server/stripe");
    setStripeFetch(async () => {
      stripeCalled = true;
      return new Response("nope", { status: 500 });
    });
    const checkout = await checkoutPost(
      new Request("http://127.0.0.1/api/store/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: "candidate-clip", qty: 1, ...ship }),
      }),
    );
    const checkoutBody = (await checkout.json()) as { error?: string; url?: string };
    assert(checkout.status === 400 && checkoutBody.error === UNVERIFIED_OFFER_LABEL && !checkoutBody.url, "checkout cannot bypass the candidate guard");
    assert(stripeCalled === false, "a refused candidate does not call Stripe");
    setStripeFetch(null);

    const offers = (await (await offersGet()).json()) as { offers: { id: string; label: string | null; href: string | null; kind: string }[] };
    const clip = offers.offers.find((item) => item.id === "candidate-clip");
    const link = offers.offers.find((item) => item.id === "approved-link");
    const tiedOffer = offers.offers.find((item) => item.id === "tied-note");
    assert(clip?.label === UNVERIFIED_OFFER_LABEL && clip.href === null, "the public route keeps the unverified label");
    assert(link?.kind === "affiliate" && link.href === "https://supplier.example/offer", "the public route keeps an approved affiliate link");
    assert(tiedOffer?.kind === "unverified", "a tied listing is not presented as fulfillment while checkout is closed");
    const afterTie = (await (await catalogGet()).json()) as {
      products: { id: string; availability: string; purchasable: boolean }[];
    };
    const tiedCard = afterTie.products.find((item) => item.id === "ready-pan");
    assert(tiedCard?.availability === "unavailable" && tiedCard.purchasable === false, "a tied candidate is not listed as in stock");
  } finally {
    resetSourcedOffersForTests();
    delete process.env.STRIPE_SECRET_KEY;
    const { setStripeFetch } = await import("../src/lib/server/stripe");
    setStripeFetch(null);
  }

  const restored = createPendingOrder({ productId: "ready-pan", qty: 1, ship });
  if ("error" in restored) throw new Error(restored.error);
  closeDb();
  console.log("offer checks ok");
}

main();
