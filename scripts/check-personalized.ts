import { mkdtempSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonalizedCards } from "../src/components/personalized-cards";
import { PersonalizedForm } from "../src/components/personalized-form";
import {
  PERSONALIZED_CLOSED,
  PERSONALIZED_PURCHASES_OPEN,
  cleanPersonalizedText,
  formatJobSheet,
  type PersonalizedJob,
} from "../src/lib/personalized";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-personalized-")), "personalized.sqlite");
delete process.env.STRIPE_SECRET_KEY;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...walk(path));
    else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".md")) found.push(path);
  }
  return found;
}

const machine = ["Cri", "cut"].join("");

async function main() {
  assert(PERSONALIZED_PURCHASES_OPEN === false, "personalized purchases stay closed");
  assert(cleanPersonalizedText("  Ada  ").text === "Ada", "letters are trimmed");
  assert("error" in cleanPersonalizedText("   "), "an empty name is refused");
  assert("error" in cleanPersonalizedText("A".repeat(41)), "a long name is refused");
  assert(cleanPersonalizedText("Ada\u0000 Lane").text === "Ada Lane", "control characters are removed");

  const job: PersonalizedJob = {
    id: "job-1",
    orderId: null,
    designId: "none",
    designVersion: "0",
    customText: "Ada",
    material: null,
    color: null,
    sizeLabel: null,
    qty: 1,
    productionStatus: "new",
    carrier: null,
  trackingNumber: null,
  productId: null,
  priceCents: null,
};
  const sheet = formatJobSheet(job);
  assert(sheet.includes("Text Ada") && sheet.includes("Order not paid"), "the sheet keeps the letters and the unpaid state");
  assert(!/email|street|@|line1/i.test(sheet), "the sheet has no buyer contact");

  const form = renderToStaticMarkup(createElement(PersonalizedForm, null));
  assert(form.includes("Original artwork is not on this site yet."), "the form says original artwork is not on the site");
  assert(form.includes("Not available to purchase"), "the form does not offer a buy button");
  assert(!form.toLowerCase().includes(machine.toLowerCase()), "the form does not name the machine");
  assert(!form.includes('type="file"'), "the form does not accept a file");

  const { personalizedPriceSnapshot, personalizedProducts } = await import("../src/data/personalized-products");
  assert(personalizedProducts.filter((item) => item.kind === "physical").length === 7, "seven items are physical");
  assert(personalizedProducts.filter((item) => item.kind === "digital").length === 1, "one item is digital");
  const expected: Record<string, { priceCents: number; packSize: number | null; kind: string }> = {
    "happy-camper-gable-boxes": { priceCents: 3000, packSize: 6, kind: "physical" },
    "happy-camper-cake-topper": { priceCents: 2500, packSize: null, kind: "physical" },
    "happy-camper-cupcake-toppers": { priceCents: 1800, packSize: 14, kind: "physical" },
    "happy-camper-party-bundle": { priceCents: 6500, packSize: null, kind: "physical" },
    "little-pumpkin-cake-topper": { priceCents: 1700, packSize: null, kind: "physical" },
    "lucky-duck-cake-topper-girl": { priceCents: 2500, packSize: null, kind: "physical" },
    "lucky-duck-cake-topper-boy": { priceCents: 2500, packSize: null, kind: "physical" },
    "little-pumpkin-website-invitation": { priceCents: 1800, packSize: null, kind: "digital" },
  };
  for (const [id, want] of Object.entries(expected)) {
    const item = personalizedProducts.find((product) => product.id === id);
    assert(item?.priceCents === want.priceCents && item.packSize === want.packSize && item.kind === want.kind, `${id} keeps the verified price and pack`);
    assert(personalizedPriceSnapshot(id)?.priceCents === want.priceCents, `${id} snapshots the catalog price`);
  }
  assert(personalizedProducts.find((item) => item.id === "happy-camper-gable-boxes")?.lettering?.maxChars === 30, "the box lettering cap is 30");
  assert(personalizedProducts.find((item) => item.id === "happy-camper-cake-topper")?.lettering?.maxChars === 30, "the topper lettering cap is 30");
  assert(personalizedProducts.find((item) => item.id === "happy-camper-party-bundle")?.summary === "What is inside this bundle is not on file.", "the bundle contents stay unlisted");
  assert(!personalizedProducts.some((item) => item.summary.includes("5.80") || item.summary.includes("7.68")), "example postage is not copied");

  const cards = renderToStaticMarkup(createElement(PersonalizedCards));
  assert(cards.includes("One Happy Camper Gable Boxes") && cards.includes("$30.00") && cards.includes("Set of 6"), "the boxes show the set price");
  assert(cards.includes("$65.00") && cards.includes("What is inside this bundle is not on file."), "the bundle shows its price without invented contents");
  assert(cards.includes("Digital. Not shipped.") && cards.includes("Our Little Pumpkin Interactive Website Invitation"), "the invitation is digital and not shipped");
  assert(cards.includes("Not available to purchase"), "every card stays closed");
  assert(!/etsy|elaverix|cricut|listing\/\d+/i.test(cards), "the cards do not name the source shop or a machine");

  const forbidden = ["etsy", "elaverix", "cricut", "4571738617", "4539694612", "4571705376", "4572199639", "4592749760", "4502737670", "4498605000", "4607208908"];
  for (const path of walk(join(process.cwd(), "src"))) {
    const source = readFileSync(path, "utf8").toLowerCase();
    for (const word of forbidden) {
      assert(!source.includes(word), `${path} includes ${word}`);
    }
  }

  for (const path of walk(join(process.cwd(), "src"))) {
    if (!path.includes("personalized") && !path.endsWith("store-header.tsx") && !path.endsWith("shop-footer.tsx")) continue;
    const source = readFileSync(path, "utf8");
    assert(!source.toLowerCase().includes(machine.toLowerCase()), `${path} names the machine`);
  }

  const { getDb } = await import("../src/lib/server/db");
  const { savePersonalizedJob } = await import("../src/lib/server/personalized-jobs");
  const { POST, GET } = await import("../src/app/api/personalized/route");
  const { GET: jobsGet } = await import("../src/app/api/personalized/jobs/route");
  const { signUp } = await import("../src/lib/server/accounts");
  const { SESSION_COOKIE } = await import("../src/lib/server/session-cookie");

  const before = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  const jobsBefore = (getDb().prepare("SELECT COUNT(*) AS n FROM personalized_jobs").get() as { n: number }).n;
  const closed = savePersonalizedJob({ customText: "Ada" });
  assert(closed.error === PERSONALIZED_CLOSED, "a valid name still does not open an order");
  const blank = await POST(
    new Request("http://127.0.0.1/api/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customText: " " }),
    }),
  );
  const blankBody = (await blank.json()) as { error?: string };
  assert(blank.status === 400 && blankBody.error === "Add the name or monogram.", "the server refuses an empty name");
  const refused = await POST(
    new Request("http://127.0.0.1/api/personalized", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ customText: "Ada" }),
    }),
  );
  const refusedBody = (await refused.json()) as { error?: string; url?: string };
  assert(refused.status === 403 && refusedBody.error === PERSONALIZED_CLOSED && !refusedBody.url, "checkout stays closed");
  const after = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  const jobsAfter = (getDb().prepare("SELECT COUNT(*) AS n FROM personalized_jobs").get() as { n: number }).n;
  assert(after === before && jobsAfter === jobsBefore, "a closed personalized request writes nothing");

  const catalog = (await (await GET()).json()) as {
    open?: boolean;
    designs?: unknown[];
    products?: { id: string; purchasable: boolean; priceCents: number; kind: string }[];
  };
  const catalogJson = JSON.stringify(catalog);
  assert(catalog.open === false && catalog.designs?.length === 0, "the public catalog has no approved design");
  assert(catalog.products?.length === 8 && catalog.products.every((item) => item.purchasable === false), "the eight items are listed and not purchasable");
  assert(catalog.products?.find((item) => item.id === "happy-camper-gable-boxes")?.priceCents === 3000, "the public price for the boxes is 3000 cents");
  assert(catalog.products?.find((item) => item.id === "little-pumpkin-website-invitation")?.kind === "digital", "the invitation stays digital");
  assert(!/etsy|elaverix|cricut|https?:/i.test(catalogJson), "the public personalized payload has no source link");

  const { POST: checkoutPost } = await import("../src/app/api/store/checkout/route");
  const { POST: cartPost } = await import("../src/app/api/store/cart/route");
  const { createPendingOrder } = await import("../src/lib/server/store");
  process.env.STRIPE_SECRET_KEY = "sk_test_personalized";
  process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
  let stripeCalled = false;
  const { setStripeFetch } = await import("../src/lib/server/stripe");
  setStripeFetch(async () => {
    stripeCalled = true;
    return new Response("nope", { status: 500 });
  });
  const ship = {
    name: "Example Buyer",
    email: "buyer@example.com",
    line1: "100 Example Street",
    city: "Sample City",
    region: "ST",
    postal: "00000",
    country: "US",
  };
  for (const item of personalizedProducts) {
    const checkout = await checkoutPost(
      new Request("http://127.0.0.1/api/store/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: item.id, qty: 1, priceCents: 1, ...ship }),
      }),
    );
    const checkoutBody = (await checkout.json()) as { error?: string; url?: string };
    assert(checkout.status === 400 && checkoutBody.error === PERSONALIZED_CLOSED && !checkoutBody.url, `${item.id} checkout stays closed`);
    const cart = await cartPost(
      new Request("http://127.0.0.1/api/store/cart", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: item.id, qty: 1 }),
      }),
    );
    const cartBody = (await cart.json()) as { error?: string };
    assert(cart.status === 400 && cartBody.error === PERSONALIZED_CLOSED, `${item.id} cannot be added to the cart`);
  }
  const direct = createPendingOrder({ productId: "happy-camper-gable-boxes", qty: 1, ship });
  assert("error" in direct && direct.error === PERSONALIZED_CLOSED, "a direct order for a personalized id is refused");
  assert(stripeCalled === false, "a personalized id does not call Stripe");
  setStripeFetch(null);
  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.REQUIRE_SUPPLIER_CONFIRMED;

  const stranger = await jobsGet(new Request("http://127.0.0.1/api/personalized/jobs"));
  assert(stranger.status === 403, "job tickets are not public");
  const joined = signUp({ name: "Personalized Operator", email: "personalized-operator@example.com", password: "personalized-test" });
  if ("error" in joined) throw new Error(joined.error);
  getDb().prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(joined.account.id);
  const operator = await jobsGet(
    new Request("http://127.0.0.1/api/personalized/jobs", { headers: { cookie: `${SESSION_COOKIE}=${joined.token}` } }),
  );
  const operatorBody = (await operator.json()) as { jobs?: unknown[]; line1?: string };
  assert(operator.status === 200 && operatorBody.jobs?.length === 0, "a verified operator sees an empty queue");
  assert(!JSON.stringify(operatorBody).includes("line1") && !JSON.stringify(operatorBody).includes("@"), "the queue has no buyer contact");

  const buyer = signUp({ name: "Personalized Buyer", email: "personalized-buyer@example.com", password: "personalized-test" });
  if ("error" in buyer) throw new Error(buyer.error);
  const buyerJobs = await jobsGet(
    new Request("http://127.0.0.1/api/personalized/jobs", { headers: { cookie: `${SESSION_COOKIE}=${buyer.token}` } }),
  );
  assert(buyerJobs.status === 403, "a buyer cannot read job tickets");
  const escalated = await POST(
    new Request("http://127.0.0.1/api/personalized", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: `${SESSION_COOKIE}=${buyer.token}` },
      body: JSON.stringify({ customText: "Ada", role: "admin", priceCents: 1899, designId: "preset" }),
    }),
  );
  assert(escalated.status === 403, "extra fields do not open a personalized order");
  const buyerRole = getDb().prepare("SELECT role FROM accounts WHERE id = ?").get(buyer.account.id) as { role: string };
  assert(buyerRole.role === "buyer", "a personalized post does not grant admin");
  getDb().prepare("UPDATE accounts SET role = 'reseller', email_verified = 1 WHERE id = ?").run(buyer.account.id);
  const resellerJobs = await jobsGet(
    new Request("http://127.0.0.1/api/personalized/jobs", { headers: { cookie: `${SESSION_COOKIE}=${buyer.token}` } }),
  );
  assert(resellerJobs.status === 403, "a reseller cannot read job tickets");
  getDb().prepare("UPDATE accounts SET role = 'admin', email_verified = 0 WHERE id = ?").run(buyer.account.id);
  const unverifiedJobs = await jobsGet(
    new Request("http://127.0.0.1/api/personalized/jobs", { headers: { cookie: `${SESSION_COOKIE}=${buyer.token}` } }),
  );
  assert(unverifiedJobs.status === 403, "an unverified admin cannot read job tickets");
  const jobsStill = (getDb().prepare("SELECT COUNT(*) AS n FROM personalized_jobs").get() as { n: number }).n;
  const ordersStill = (getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number }).n;
  assert(jobsStill === jobsAfter && ordersStill === after, "a crafted personalized post still writes nothing");

  const events = readFileSync(join(process.cwd(), "src/lib/server/stripe-events.ts"), "utf8");
  const jobsSource = readFileSync(join(process.cwd(), "src/lib/server/personalized-jobs.ts"), "utf8");
  assert(!events.includes("personalized"), "the Stripe webhook does not write a personalized job");
  assert(!jobsSource.includes("UPDATE personalized_jobs"), "a job row is not rewritten");

  process.env.APP_URL = "https://xvaisle.com";
  const { postOriginAllowed } = await import("../src/lib/server/same-origin");
  assert(
    postOriginAllowed(new Request("https://xvaisle.com/api/supplier/delivered", { method: "POST" })) === false,
    "a supplier delivery with no origin is still refused",
  );
  assert(
    postOriginAllowed(new Request("https://xvaisle.com/api/billing/webhook", { method: "POST" })) === true,
    "the Stripe billing webhook stays exempt",
  );
  assert(
    postOriginAllowed(new Request("https://xvaisle.com/api/connect/webhook", { method: "POST" })) === true,
    "the Stripe connect webhook stays exempt",
  );
  assert(
    postOriginAllowed(new Request("https://xvaisle.com/api/personalized", { method: "POST" })) === false,
    "a personalized post with no origin is refused",
  );

  console.log("personalized checks ok");
}

main();
