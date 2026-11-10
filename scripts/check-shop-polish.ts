import { createElement } from "react";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-polish-")), "shop.sqlite");
delete process.env.SHOW_PRICES;
delete process.env.REQUIRE_SUPPLIER_CONFIRMED;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const { showShopPrices, productShopperJsonLd, SHOP_CARD_STATUS } = await import("../src/lib/shop-prices");
  const { stallsWithProducts, stallProductCount } = await import("../src/lib/shop-stalls");
  const { planAisleUpdates } = await import("../src/lib/shop-aisle-plan");
  const { ShopCardCopy } = await import("../src/components/shop-grid");
  const { ProductBuy } = await import("../src/components/product-buy");
  const { sitemapListsProduct } = await import("../src/app/sitemap");
  const { GET } = await import("../src/app/api/store/listings/route");
  const { getDb } = await import("../src/lib/server/db");

  assert(showShopPrices(undefined) === false, "prices stay hidden when the flag is unset");
  assert(showShopPrices("") === false, "a blank flag stays hidden");
  assert(showShopPrices("0") === false, "SHOW_PRICES=0 stays hidden");
  assert(showShopPrices("off") === false, "SHOW_PRICES=off stays hidden");
  assert(showShopPrices("1") === true, "SHOW_PRICES=1 shows prices");
  assert(showShopPrices("true") === true, "SHOW_PRICES=true shows prices");

  const hiddenLd = productShopperJsonLd({ name: "Pan", url: "https://xvaisle.com/shop/pan", priceCents: 2599 }, false);
  assert(!("offers" in hiddenLd) && !JSON.stringify(hiddenLd).includes("price"), "hidden prices stay out of structured data");
  const shownLd = productShopperJsonLd({ name: "Pan", url: "https://xvaisle.com/shop/pan", priceCents: 2599 }, true);
  assert(JSON.stringify(shownLd).includes('"price":"25.99"'), "turning prices on restores the offer");

  const listings = [
    { productId: "wheel", aisle: "everyday-finds", image: "/art/products/6-inch-yoga-wheel.jpg" },
    { productId: "old", aisle: "build-your-rig", image: "/art/products/yoga-pilates-ring.jpg" },
    { productId: "lanyard", aisle: "tech-and-desk", image: "/art/products/cell-phone-lanyard.jpg" },
    { productId: "towel", aisle: "home-and-gifts", image: "/art/products/beagle-luau-kitchen-towel.jpg" },
    { productId: "blank", aisle: "home-and-gifts", image: "" },
    { productId: "set", kind: "bundle" as const, aisle: "bundles", image: "/art/mock-sheet-pan-1.png" },
  ];
  const photos = listings.filter((item) => item.image.startsWith("/art/"));
  assert(stallProductCount(photos, "everyday-finds") === 2, "Everyday Finds counts the new slug and the old rig slug");
  assert(stallProductCount(photos, "bundles") === 1, "a bundle counts toward Bundles");
  const tabs = stallsWithProducts(photos.filter((item) => item.kind !== "bundle" && item.productId !== "set"));
  assert(!tabs.some((tab) => tab.slug === "bundles"), "an empty Bundles aisle stays hidden");
  assert(tabs.map((tab) => tab.slug).join() === "everyday-finds,tech-and-desk,home-and-gifts", "tabs follow the cards that have photos");

  const card = { productId: "wheel", title: "6-Inch Yoga Wheel", priceCents: 2599, image: "/art/products/6-inch-yoga-wheel.jpg" };
  const quiet = renderToStaticMarkup(createElement(ShopCardCopy, { listing: card, showPrices: false }));
  assert(quiet.includes(SHOP_CARD_STATUS), "a card says Coming soon");
  assert(!quiet.includes("$") && !quiet.includes("·"), "a hidden price does not leave a dollar or a middle dot");
  const priced = renderToStaticMarkup(createElement(ShopCardCopy, { listing: card, showPrices: true }));
  assert(priced.includes("$25.99") && priced.includes(SHOP_CARD_STATUS), "prices on restores the price beside Coming soon");

  const listing = {
    productId: "wheel",
    sku: "YW-1",
    title: "6-Inch Yoga Wheel",
    description: "6-Inch Yoga Wheel",
    priceCents: 2599,
    image: "/art/products/6-inch-yoga-wheel.jpg",
    supplierName: "Example",
    shelf: "national",
  };
  const page = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/wheel",
      showPrices: false,
    }),
  );
  assert(page.includes("Coming soon") && page.includes("Not available yet"), "the product page keeps its existing unavailable state");
  assert(!page.includes("$25.99") && !page.includes("Continue to checkout"), "the product page hides the price and the buy button");
  const open = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/wheel",
      showPrices: true,
      unconfirmed: false,
    }),
  );
  assert(open.includes("$25.99"), "turning the flag on restores the product price");

  const base = {
    supplierName: "Example Seller",
    published: true,
    title: "Pan",
    supplierUsConfirmed: true,
    shipsFrom: "Austin, TX",
  };
  assert(sitemapListsProduct({ ...base, productId: "photo", image: "/art/mock-sheet-pan-1.png" }) === true, "a real photo stays in the sitemap");
  assert(sitemapListsProduct({ ...base, productId: "blank", image: "" }) === false, "a blank image stays out of the sitemap");
  assert(sitemapListsProduct({ ...base, productId: "mark", image: "/xv-aisle-mark.svg" }) === false, "the mark stays out of the sitemap");
  assert(
    sitemapListsProduct({ ...base, productId: "glow", image: "/brand/hero-aisle-pedestals.webp" }) === false,
    "the aisle plate stays out of the sitemap",
  );

  const db = getDb();
  db.prepare(
    `INSERT INTO listings (
      product_id, account_id, sku, title, description, price_cents, image,
      supplier_name, supplier_origin, ship_days_min, ship_days_max, published,
      made_in_usa, shelf, supplier_cost_cents, supplier_shipping_cents, route, kind,
      hidden_from_shop, supplier_us_confirmed
    ) VALUES (?, 'acct', ?, ?, ?, ?, ?, 'Example', 'US', 2, 4, 1, 0, 'national', 0, 0, 'manual', 'single', 0, 1)`,
  ).run("photo-pan", "P-1", "Photo pan", "Photo pan", 2000, "/art/mock-sheet-pan-1.png");
  const insert = db.prepare(
    `INSERT INTO listings (
      product_id, account_id, sku, title, description, price_cents, image,
      supplier_name, supplier_origin, ship_days_min, ship_days_max, published,
      made_in_usa, shelf, supplier_cost_cents, supplier_shipping_cents, route, kind,
      hidden_from_shop, supplier_us_confirmed
    ) VALUES (?, 'acct', ?, ?, ?, 2000, ?, 'Example', 'US', 2, 4, 1, 0, 'national', 0, 0, 'manual', 'single', 0, 1)`,
  );
  insert.run("blank-pan", "P-2", "Blank pan", "Blank pan", "");
  insert.run("mark-pan", "P-3", "Mark pan", "Mark pan", "/xv-aisle-mark.svg");
  insert.run("glow-pan", "P-4", "Glow pan", "Glow pan", "/brand/hero-aisle-pedestals.webp");
  const response = await GET(new Request("http://127.0.0.1/api/store/listings"));
  const body = (await response.json()) as { listings: { productId: string }[] };
  const ids = body.listings.map((item) => item.productId);
  assert(ids.includes("photo-pan"), "the listings API keeps a real photo");
  assert(!ids.includes("blank-pan"), "the listings API hides a missing photo");
  assert(!ids.includes("mark-pan"), "the listings API hides the mark");
  assert(!ids.includes("glow-pan"), "the listings API hides the aisle plate");

  const plan = planAisleUpdates([
    { product_id: "6-inch-yoga-wheel", aisle: null },
    { product_id: "cell-phone-lanyard", aisle: "tech-and-desk" },
  ]);
  assert(plan.find((item) => item.productId === "6-inch-yoga-wheel")?.action === "update", "a missing aisle is tagged");
  assert(plan.find((item) => item.productId === "cell-phone-lanyard")?.action === "unchanged", "the same aisle is left alone");
  assert(plan.find((item) => item.productId === "pet-seat-belt-tether")?.action === "missing", "a row that is not in the database is reported");

  const { productIsPackshot, SHOP_PACKSHOTS } = await import("../src/lib/shop-packshot");
  for (const [slug, packshot] of Object.entries(SHOP_PACKSHOTS)) {
    assert(productIsPackshot(slug) === packshot, `${slug} keeps its packshot flag`);
  }
  assert(productIsPackshot("unknown-pan") === false, "an unknown product is not a packshot");
  assert(productIsPackshot("6-inch-yoga-wheel", { packshot: true }) === true, "a listing field can turn a packshot on");
  assert(productIsPackshot("cell-phone-lanyard", { packshot: false }) === false, "a listing field can turn a packshot off");

  const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  assert(!/\.stall-tab:focus-visible[\s\S]{0,220}outline:\s*none/.test(css), "stall tabs do not remove the focus outline");
  assert(!/transition:[^;{}]*box-shadow/.test(css), "cards and tabs do not transition box-shadow");
  const shopFrame = readFileSync(join(process.cwd(), "src/components/shop-frame.tsx"), "utf8");
  const shopPage = readFileSync(join(process.cwd(), "src/app/shop/page.tsx"), "utf8");
  assert(!shopFrame.includes("page-enter") && !shopPage.includes("page-enter"), ".page-enter is absent on /shop");

  const safety = readFileSync(join(process.cwd(), "src/app/shop/safety/page.tsx"), "utf8");
  assert(
    safety.includes("Once buying opens, you'll pick a product, pay on this site, and the supplier will ship it to you."),
    "How buying works uses the approved next line",
  );
  assert(!safety.includes("You pick a product, pay on this site, and the supplier ships it to you."), "the old buying line is gone");
  const shopGrid = readFileSync(join(process.cwd(), "src/components/shop-grid.tsx"), "utf8");
  assert(shopGrid.includes("world ? world.story : lede"), "an aisle hero shows only its approved line");
  assert(!shopGrid.includes("${world.title}."), "an aisle hero does not repeat the aisle name");
  const motif = readFileSync(join(process.cwd(), "src/components/night-motif.tsx"), "utf8");
  assert(motif.includes('d="M9 8.5V7a3 3 0 0 1 6 0v1.5"'), "Everyday Finds uses a basket");
  assert(!motif.includes('d="M5 19V7"'), "the old rig bars are gone");
  const home = readFileSync(join(process.cwd(), "src/components/home-screen.tsx"), "utf8");
  assert(
    home.includes(
      "lede=\"Every item is reviewed before it's listed. Shipping details are added to each product once its supplier confirms them.\"",
    ),
    "In the store uses the approved subhead",
  );
  assert(!home.includes("Pay safely with Stripe, and your order ships straight to your door."), "the old In the store subhead is gone");
  const art = readFileSync(join(process.cwd(), "src/lib/art.ts"), "utf8");
  assert(art.includes('line: "Small, handy things for home, workouts and the road."'), "Everyday Finds uses the approved tile line");
  assert(!art.includes("Everything for your setup in one place, or grab it all as a set."), "the old Everyday Finds tile line is gone");
  assert(!art.includes("aisle-card-build-your-rig.webp"), "Everyday Finds art no longer points at the rig still");
  assert(art.includes("/art/aisle-card-everyday-finds.webp"), "Everyday Finds art uses the new still");
  assert(art.includes('title: "Tech & Desk"'), "the home strip names Tech & Desk");
  assert(art.includes('line: "Small gear for the desk and the day."'), "the Tech & Desk tile keeps its line");
  assert(art.includes('href: "/shop?aisle=tech-and-desk"'), "the Tech & Desk tile opens that aisle");
  assert(art.includes('src: "/art/home-tile-tech-and-desk.webp"'), "the home Tech & Desk tile uses its own still");
  assert(art.includes('"tech-and-desk": "/art/aisle-card-tech-and-desk.webp"'), "shop tabs keep the night Tech & Desk still");
  assert(!art.includes('title: "Electronics"'), "the Electronics tile is renamed");
  const departments = readFileSync(join(process.cwd(), "src/components/department-grid.tsx"), "utf8");
  assert(!departments.includes("1.4fr"), "department cards share one column width");
  assert(!departments.includes("h-full"), "a short department card does not stretch into an empty shell");
  assert(departments.includes("items-start"), "department cards stay as tall as their own art");

  console.log("shop polish checks ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
