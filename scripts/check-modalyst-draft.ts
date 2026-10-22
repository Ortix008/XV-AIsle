import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkTile } from "../src/components/mark-tile";
import { ProductFrame } from "../src/components/product-frame";
import { money } from "../src/lib/money";
import { productShipLine, TRACKING_SHIP } from "../src/lib/order-facts";
import { PRODUCT_PHOTO_SIZE } from "../src/lib/product-photo";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-draft-")), "draft.sqlite");

const CATALOG = join(process.cwd(), "catalog/modalyst-draft.json");
const ALLOWED = ["slug", "title", "sku", "description", "price_cents", "image"];

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function textOf(html: string, className: string) {
  const match = html.match(new RegExp(`class="${className}">([^<]*)`));
  return match?.[1] ?? "";
}

const PHOTO_SHA256: Record<string, string> = {
  "christmas-tree-cat-house-flag.jpg": "ac0a1ab93607a0e18557caa76eef05f0f6d18dee69afbfd8c324084e4c8e3049",
  "garnet-jewelry-gift-set.jpg": "c4b16f663d69eb8289be8212250c29a8f182d8cf164a028fc0b61c40548b9f99",
  "insulated-dog-raincoat-dark-blue.jpg": "10606a2dde9841be9e26faabfd98dcc991874f4ff472415f1e05e23487d3c5a1",
  "pearl-jewelry-gift-set.jpg": "5afc5a182d114f7e43f6c28c2f5ddb8c640051ac634c56907cb1ee801b5eab83",
  "reversible-dog-raincoat-green.jpg": "c308138653995b450f4f7ccb5334879682186258962c4c9e11ee8bad0204395e",
};

function jpegBox(buf: Buffer) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error("not a jpeg");
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] !== 0xff) throw new Error("broken jpeg");
    const marker = buf[i + 1] ?? 0;
    if (marker === 0xda || marker === 0xd9) break;
    const length = buf.readUInt16BE(i + 2);
    const payload = buf.subarray(i + 4, i + 2 + length);
    if (marker === 0xe1 || payload.includes(Buffer.from("Exif")) || payload.includes(Buffer.from("GPSLatitude")) || payload.includes(Buffer.from("xmpmeta"))) {
      throw new Error("jpeg still has EXIF, GPS, or XMP");
    }
    const sof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (sof) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    i += 2 + length;
  }
  throw new Error("jpeg has no size");
}

function runDraft(path: string) {
  return spawnSync(process.execPath, ["scripts/catalog-import.mjs", "--draft", path], {
    env: { ...process.env, DATABASE_PATH: process.env.DATABASE_PATH, STORE_OPERATOR_EMAIL: "draft-operator@example.com" },
    encoding: "utf8",
  });
}

async function main() {
  const raw = readFileSync(CATALOG, "utf8");
  assert(!/cost|shipping|source_url|supplier_|route|https?:/i.test(raw), "the draft catalog has no cost, shipping, supplier, or route");
  const parsed = JSON.parse(raw) as { products: Array<Record<string, unknown>> };
  assert(parsed.products.length === 5, "the draft catalog has five products");
  for (const product of parsed.products) {
    assert(Object.keys(product).every((key) => ALLOWED.includes(key)), "a draft product keeps only the public fields");
    const slug = String(product.slug);
    assert(product.image === `/art/products/${slug}.jpg`, "the image path is the jpg");
    const file = join(process.cwd(), "public", "art", "products", `${slug}.jpg`);
    const webp = join(process.cwd(), "public", "art", "products", `${slug}.webp`);
    assert(existsSync(file), "the product photo is the jpg");
    assert(!existsSync(webp), "next/image makes the webp, so no second file is stored");
    const bytes = readFileSync(file);
    assert(createHash("sha256").update(bytes).digest("hex") === PHOTO_SHA256[`${slug}.jpg`], "the jpeg pixels are the cleared photo");
    const box = jpegBox(bytes);
    const expected = PRODUCT_PHOTO_SIZE[`/art/products/${slug}.jpg`];
    assert(expected && box.width === expected.width && box.height === expected.height, "the jpeg size matches the layout box");
  }
  const imageConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert(!imageConfig.includes("unoptimized: true") && !imageConfig.includes("formats:"), "the image pipeline keeps the webp default");

  const { signUp } = await import("../src/lib/server/accounts");
  const { closeDb } = await import("../src/lib/server/db");
  const { createPendingOrder, getListing, listPublished, publicShopListing } = await import("../src/lib/server/store");
  const operator = signUp({ name: "Draft Operator", email: "draft-operator@example.com", password: "import-test" });
  if ("error" in operator) throw new Error(operator.error);
  closeDb();

  const imported = runDraft(CATALOG);
  if (imported.status !== 0) throw new Error(imported.stderr || imported.stdout || "draft import failed");
  for (const product of parsed.products) {
    assert(imported.stdout.includes(`${product.slug} → hidden`), "a draft product is hidden");
  }
  assert(!imported.stdout.includes("published"), "a draft import does not publish");

  const { getDb: openDb } = await import("../src/lib/server/db");
  const db = openDb();
  const rendered: Array<{ name: string; price: string; description: string }> = [];
  for (const product of parsed.products) {
    const slug = String(product.slug);
    const row = db.prepare("SELECT * FROM listings WHERE product_id = ?").get(slug) as {
      published: number;
      hidden_from_shop: number;
      made_in_usa: number;
      supplier_us_confirmed: number;
      ship_days_min: number;
      ship_days_max: number;
      route: string;
      supplier_order_url: string | null;
      supplier_email: string | null;
      supplier_cost_cents: number;
      supplier_shipping_cents: number;
      image: string;
      description: string;
    };
    assert(row.published === 0 && row.hidden_from_shop === 1, "the listing stays unpublished and hidden");
    assert(row.made_in_usa === 0 && row.supplier_us_confirmed === 0, "the listing is not a made-in or confirmed supplier");
    assert(row.ship_days_min === 0 && row.ship_days_max === 0, "the listing has no ship days");
    assert(row.route === "" && row.supplier_order_url == null && row.supplier_email == null, "the listing has no order route or supplier address");
    assert(row.supplier_cost_cents === 0 && row.supplier_shipping_cents === 0, "the listing has no supplier cost or shipping");
    assert(row.image === product.image, "the stored image path is the held jpg");
    const catalog = db.prepare("SELECT id FROM supplier_catalog WHERE id = ?").get(`import-${slug}`);
    assert(!catalog, "a draft does not write a supplier catalog row");
    assert(!listPublished().some((item) => item.productId === slug), "the shop list hides the draft");
    const listing = getListing(slug);
    if (!listing) throw new Error("the draft listing was not stored");
    const page = publicShopListing(listing, false);
    const ship = productShipLine(listing);
    const html = renderToStaticMarkup(
      createElement(
        "article",
        null,
        createElement("h1", { className: "product-title" }, page.title),
        createElement("p", { className: "product-price" }, money(page.priceCents / 100)),
        createElement("p", { className: "product-desc" }, page.description),
        createElement("p", { className: "product-ship" }, ship),
      ),
    );
    assert(textOf(html, "product-desc") === page.description, "the shopper description is the catalog description");
    assert(textOf(html, "product-ship") === TRACKING_SHIP, "a draft shows only the tracking line");
    assert(!html.includes("Made in") && !html.includes("USA"), "a draft shows no made-in claim");
    assert(!/\d+\s*[–-]\s*\d+\s*days/.test(html), "a draft shows no ship-day window");
    const checkout = createPendingOrder({
      productId: slug,
      qty: 1,
      ship: { name: "Example Buyer", email: "buyer@example.com", line1: "100 Example Street", city: "Sample City", region: "ST", postal: "00000", country: "US" },
    });
    assert("error" in checkout && checkout.error === "That page is not on the store.", "a hidden draft cannot be ordered");
    rendered.push({
      name: textOf(html, "product-title"),
      price: textOf(html, "product-price"),
      description: textOf(html, "product-desc"),
    });
  }
  const mark = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
  const tile = readFileSync(join(process.cwd(), "src/components/mark-tile.tsx"), "utf8");
  const frame = readFileSync(join(process.cwd(), "src/components/product-frame.tsx"), "utf8");
  assert(mark.includes(".mark-underlay") && mark.includes("viewBox"), "the shop photo underlay is the XV mark");
  assert(tile.includes("mark-underlay") && tile.includes("onError"), "a missing shop photo falls back to the underlay");
  assert(frame.includes("product-placeholder") && frame.includes(">XV<"), "a missing product photo falls back to the XV mark");
  assert(mark.includes(".product-frame") && mark.includes("aspect-ratio: 4 / 5") && mark.includes("position: relative"), "the product frame reserves its box");
  assert(mark.includes(".product-frame > img[width]") && mark.includes(".mark-tile img[width]"), "a sized photo stays inside the frame");
  const pearl = "/art/products/pearl-jewelry-gift-set.jpg";
  const frameHtml = renderToStaticMarkup(createElement(ProductFrame, { src: pearl, alt: "Pearl Jewelry Gift Set", sizes: "280px", priority: true }));
  assert(frameHtml.includes('loading="lazy"'), "a draft photo lazy-loads");
  assert(frameHtml.includes('width="1920"') && frameHtml.includes('height="1920"'), "a draft photo has fixed dimensions");
  assert(!frameHtml.includes("preload"), "a draft photo is not preloaded");
  const tileHtml = renderToStaticMarkup(createElement(MarkTile, { src: pearl, alt: "", sizes: "280px" }));
  assert(tileHtml.includes('loading="lazy"') && tileHtml.includes('width="1920"') && tileHtml.includes('height="1920"'), "a draft tile lazy-loads at a fixed size");
  console.log(JSON.stringify(rendered));
  console.log("modalyst draft checks ok");
  db.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
