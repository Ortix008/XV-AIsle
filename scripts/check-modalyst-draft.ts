import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkTile } from "../src/components/mark-tile";
import { ProductBuy } from "../src/components/product-buy";
import { ProductFrame } from "../src/components/product-frame";
import { ShopGrid } from "../src/components/shop-grid";
import { draftPublishError, eligibleToPublishLater, GARNET_TYPE } from "../src/lib/draft-holds";
import { money } from "../src/lib/money";
import { productShipLine, TRACKING_SHIP } from "../src/lib/order-facts";
import { PRODUCT_PHOTO_SIZE } from "../src/lib/product-photo";
import { SOLD_OUT_LABEL } from "../src/lib/sold-out";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-draft-")), "draft.sqlite");

const CATALOG = join(process.cwd(), "catalog/modalyst-draft.json");
const COPY = join(process.cwd(), "catalog/modalyst-copy-oct22.md");
const ALLOWED = ["slug", "title", "sku", "description", "specs", "price_cents", "image", "variants", "stock_count"];
const COPY_SLUG: Record<string, string> = {
  "XV-MOD-L83": "pearl-jewelry-gift-set",
  "XV-MOD-L81": "garnet-jewelry-gift-set",
  "XV-MOD-L47": "insulated-dog-raincoat-dark-blue",
  "XV-MOD-L51": "reversible-dog-raincoat-green",
  "XV-MOD-L54": "christmas-tree-cat-house-flag",
};
const STOCK: Record<string, number | null> = {
  "pearl-jewelry-gift-set": 2,
  "garnet-jewelry-gift-set": 1,
  "christmas-tree-cat-house-flag": 999,
  "insulated-dog-raincoat-dark-blue": null,
  "reversible-dog-raincoat-green": null,
};
const VARIANT_STOCK: Record<string, Array<{ size: string; sku: string; stock_count: number }>> = {
  "insulated-dog-raincoat-dark-blue": [
    { size: "2XS", sku: "GJ472F2-DB-2XS", stock_count: 30 },
    { size: "XS", sku: "GJ472F2-DB-XS", stock_count: 41 },
  ],
  "reversible-dog-raincoat-green": [
    { size: "2XS", sku: "GJ023S0-GREEN-2XS", stock_count: 25 },
    { size: "XS", sku: "GJ023S0-GREEN-XS", stock_count: 161 },
  ],
};
const SHIP = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};
const RAIN_SIZES: Record<string, Array<{ size: string; sku: string }>> = {
  "insulated-dog-raincoat-dark-blue": [
    { size: "2XS", sku: "GJ472F2-DB-2XS" },
    { size: "XS", sku: "GJ472F2-DB-XS" },
  ],
  "reversible-dog-raincoat-green": [
    { size: "2XS", sku: "GJ023S0-GREEN-2XS" },
    { size: "XS", sku: "GJ023S0-GREEN-XS" },
  ],
};

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function textOf(html: string, className: string) {
  return textsOf(html, className)[0] ?? "";
}

function textsOf(html: string, className: string) {
  return [...html.matchAll(new RegExp(`class="${className}"[^>]*>([^<]*)`, "g"))].map((match) => match[1] ?? "");
}

type ApprovedProduct = {
  sku: string;
  status: "approved" | "HOLD";
  title: string;
  description: string;
  specs: string[];
};

function approvedCopy(file: string) {
  const products: ApprovedProduct[] = [];
  for (const block of file.split(/^### /m).slice(1)) {
    const head = block.split("\n")[0] ?? "";
    const sku = head.match(/\((XV-MOD-L\d+)\)/)?.[1];
    if (!sku) continue;
    const status = head.includes("Status: HOLD") ? "HOLD" : head.includes("Status: approved") ? "approved" : null;
    const title = block.match(/^- Title: (.*)$/m)?.[1];
    const description = block.match(/^- Description: (.*)$/m)?.[1];
    const specs = block
      .split("\n")
      .filter((line) => line.startsWith("  - "))
      .map((line) => line.slice(4));
    if (status !== "HOLD" && status !== "approved") throw new Error(`the copy file is missing a status for ${sku}`);
    if (title == null || description == null || specs.length === 0) throw new Error(`the copy file is missing lines for ${sku}`);
    products.push({ sku, status, title, description, specs });
  }
  const label = file.match(/^- Label: (.*)$/m)?.[1] ?? "";
  return { products, label };
}

function linesAfter(file: string, prefix: string) {
  return file
    .split("\n")
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length));
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

function setStock(email: string, extra: string[]) {
  return spawnSync(process.execPath, ["scripts/set-stock.mjs", ...extra], {
    env: { ...process.env, DATABASE_PATH: process.env.DATABASE_PATH, STORE_OPERATOR_EMAIL: email },
    encoding: "utf8",
  });
}

function raceOrder(productId: string, sku = "") {
  return new Promise<{ ok: boolean; error: string | null }>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/stock-order-once.ts"], {
      env: {
        ...process.env,
        DATABASE_PATH: process.env.DATABASE_PATH,
        STOCK_PRODUCT: productId,
        STOCK_QTY: "1",
        STOCK_SKU: sku,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      out += chunk;
    });
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      const line = out.trim().split("\n").filter(Boolean).at(-1);
      if (code !== 0 || !line) {
        reject(new Error(err || out || `stock race exited ${code}`));
        return;
      }
      resolve(JSON.parse(line) as { ok: boolean; error: string | null });
    });
  });
}

async function main() {
  const raw = readFileSync(CATALOG, "utf8");
  assert(!/cost|shipping|source_url|supplier_|route|https?:|margin/i.test(raw), "the draft catalog has no cost, shipping, supplier, route, or margin");
  const parsed = JSON.parse(raw) as { products: Array<Record<string, unknown>> };
  assert(parsed.products.length === 5, "the draft catalog has five products");
  const copyFile = readFileSync(COPY, "utf8");
  const approved = approvedCopy(copyFile);
  const titleLines = linesAfter(copyFile, "- Title: ");
  const descriptionLines = linesAfter(copyFile, "- Description: ");
  const bulletLines = linesAfter(copyFile, "  - ");
  const labelLines = linesAfter(copyFile, "- Label: ");
  const parsedSpecs = approved.products.flatMap((item) => item.specs);
  assert(
    titleLines.length === approved.products.length && titleLines.every((line, index) => line === approved.products[index]?.title),
    "each title is the file line",
  );
  assert(
    descriptionLines.length === approved.products.length &&
      descriptionLines.every((line, index) => line === approved.products[index]?.description),
    "each description is the file line",
  );
  assert(
    bulletLines.length === parsedSpecs.length && bulletLines.every((line, index) => line === parsedSpecs[index]),
    "each spec bullet is the file line",
  );
  assert(labelLines.length === 1 && labelLines[0] === approved.label && approved.label === SOLD_OUT_LABEL, "the sold-out label is the file line");
  assert(!readFileSync(join(process.cwd(), "src/lib/sold-out.ts"), "utf8").includes("TODO(Wordy)"), "sold out has no placeholder");
  const holdSkus = approved.products.filter((item) => item.status === "HOLD").map((item) => item.sku);
  const liveSkus = approved.products.filter((item) => item.status === "approved").map((item) => item.sku);
  assert(holdSkus.join(",") === "XV-MOD-L81,XV-MOD-L47,XV-MOD-L51", "garnet and both raincoats are on hold");
  assert(liveSkus.join(",") === "XV-MOD-L83,XV-MOD-L54", "pearl and the flag are approved");
  const copyBySku = new Map(approved.products.map((item) => [item.sku, item]));
  for (const product of parsed.products) {
    const copy = copyBySku.get(String(product.sku));
    if (!copy) throw new Error("missing copy");
    assert(product.slug === COPY_SLUG[copy.sku], "the catalog slug matches the sku");
    assert(product.title === copy.title && product.description === copy.description, "the catalog text equals the file");
    assert(JSON.stringify(product.specs) === JSON.stringify(copy.specs), "the catalog specs equal the file");
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
    const variants = VARIANT_STOCK[slug];
    if (variants) {
      assert(!Object.hasOwn(product, "stock_count"), "a sized draft keeps stock on each size");
      assert(JSON.stringify(product.variants) === JSON.stringify(variants), "the raincoat stock is per size");
    } else {
      assert(product.variants == null, "only the raincoats have sizes");
      assert(Object.is(product.stock_count, STOCK[slug]), "the draft stock is the operator count");
    }
  }
  const imageConfig = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  assert(!imageConfig.includes("unoptimized: true") && !imageConfig.includes("formats:"), "the image pipeline keeps the webp default");

  const { signUp } = await import("../src/lib/server/accounts");
  const { closeDb } = await import("../src/lib/server/db");
  const { createPendingOrder, getListing, listPublished, publicShopListing, publishListing } = await import("../src/lib/server/store");
  const { visibleOnShop } = await import("../src/lib/server/starter-shelf");
  const { SOURCED_SIZE_CHART } = await import("../src/lib/size-chart");
  assert(SOURCED_SIZE_CHART == null, "no sourced size chart exists");
  assert(GARNET_TYPE == null, "the garnet type is unconfirmed");
  const operator = signUp({ name: "Draft Operator", email: "draft-operator@example.com", password: "import-test" });
  if ("error" in operator) throw new Error(operator.error);
  const operatorId = operator.account.id;
  closeDb();

  const imported = runDraft(CATALOG);
  if (imported.status !== 0) throw new Error(imported.stderr || imported.stdout || "draft import failed");
  for (const product of parsed.products) {
    assert(imported.stdout.includes(`${product.slug} → hidden`), "a draft product is hidden");
  }
  assert(!imported.stdout.includes("published"), "a draft import does not publish");

  const { getDb: openDb } = await import("../src/lib/server/db");
  let db = openDb();
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
      title: string;
      description: string;
      specs: string | null;
      sku: string;
      size_offer: string | null;
      stock_count: number | null;
      stock_cap: number;
    };
    assert(row.published === 0 && row.hidden_from_shop === 1, "the listing stays unpublished and hidden");
    assert(row.made_in_usa === 0 && row.supplier_us_confirmed === 0, "the listing is not a made-in or confirmed supplier");
    assert(row.ship_days_min === 0 && row.ship_days_max === 0, "the listing has no ship days");
    assert(row.route === "" && row.supplier_order_url == null && row.supplier_email == null, "the listing has no order route or supplier address");
    assert(row.supplier_cost_cents === 0 && row.supplier_shipping_cents === 0, "the listing has no supplier cost or shipping");
    assert(row.image === product.image, "the stored image path is the held jpg");
    assert(row.sku === product.sku, "the listing sku stays the catalog sku");
    const sizes = RAIN_SIZES[slug] ?? null;
    assert(row.size_offer === (sizes ? JSON.stringify(sizes) : null), "the stored sizes are the offered sizes");
    assert(row.stock_cap === 1 && Object.is(row.stock_count, STOCK[slug]), "the stored parent stock is the single-sku count");
    const variants = VARIANT_STOCK[slug];
    if (variants) {
      for (const variant of variants) {
        const counted = db.prepare("SELECT stock_count FROM listing_stock WHERE product_id = ? AND sku = ?").get(slug, variant.sku) as {
          stock_count: number;
        };
        assert(counted.stock_count === variant.stock_count, "each size keeps its own count");
      }
    } else {
      const counted = db.prepare("SELECT stock_count FROM listing_stock WHERE product_id = ? AND sku = ?").get(slug, product.sku) as {
        stock_count: number;
      };
      assert(counted.stock_count === product.stock_count, "the single sku keeps its count");
    }
    const copy = copyBySku.get(String(product.sku));
    if (!copy) throw new Error("missing copy");
    assert(row.title === copy.title, "the stored title equals the file");
    assert(row.description === copy.description, "the stored description equals the file");
    assert(row.specs === JSON.stringify(copy.specs), "the stored specs equal the file");
    if (copy.status === "HOLD") assert(row.published === 0 && row.hidden_from_shop === 1, `${copy.sku} stays unpublished`);
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
    assert(!("stockCount" in page) && !("stockCap" in page) && !("soldOut" in page), "a shopper listing hides the stock count");
    const shown = JSON.stringify(page);
    assert(!shown.includes("stockCount") && !shown.includes("stock_count"), "a shopper listing has no stock field");
    if (variants) {
      const offers = "offers" in page ? page.offers : undefined;
      assert(offers != null && offers.every((offer) => !("stockCount" in offer)), "a sized listing shows its sizes without a count");
      assert(offers != null && offers.length === variants.length, "a sized listing shows each size");
    } else {
    if (slug === "christmas-tree-cat-house-flag") assert(!shown.includes("999"), "the flag count stays off the shopper page");
    }
    assert(textOf(html, "product-desc") === page.description, "the shopper description is the catalog description");
    const buyHtml = renderToStaticMarkup(
      createElement(ProductBuy, { listing: page, returnNote: "", shareHref: "https://example.com/draft" }),
    );
    const soldHtml = renderToStaticMarkup(
      createElement(ProductBuy, { listing: { ...page, soldOut: true }, returnNote: "", shareHref: "https://example.com/draft" }),
    );
    assert(textOf(buyHtml, "product-title") === copy.title, "the rendered title equals the file");
    assert(textOf(buyHtml, "product-desc") === copy.description, "the rendered description equals the file");
    assert(JSON.stringify(textsOf(buyHtml, "product-spec")) === JSON.stringify(copy.specs), "the rendered specs equal the file");
    assert(textOf(soldHtml, "product-sold-out") === approved.label, "the rendered sold-out label equals the file");
    assert(textOf(soldHtml, "product-title") === copy.title && textOf(soldHtml, "product-desc") === copy.description, "sold-out copy equals the file");
    assert(JSON.stringify(textsOf(soldHtml, "product-spec")) === JSON.stringify(copy.specs), "sold-out specs equal the file");
    assert(!buyHtml.includes("TODO(Wordy)") && !soldHtml.includes("TODO(Wordy)"), "the product page has no sold-out placeholder");
    assert(textOf(html, "product-ship") === TRACKING_SHIP, "a draft shows only the tracking line");
    assert(!html.includes("Made in") && !html.includes("USA"), "a draft shows no made-in claim");
    assert(!/\d+\s*[–-]\s*\d+\s*days/.test(html), "a draft shows no ship-day window");
    const checkout = createPendingOrder({
      productId: slug,
      qty: 1,
      ship: { name: "Example Buyer", email: "buyer@example.com", line1: "100 Example Street", city: "Sample City", region: "ST", postal: "00000", country: "US" },
    });
    assert("error" in checkout && checkout.error === "That page is not on the store.", "a hidden draft cannot be ordered");
    const hold = draftPublishError(slug);
    const liveLater = slug === "pearl-jewelry-gift-set" || slug === "christmas-tree-cat-house-flag";
    assert(eligibleToPublishLater(slug) === liveLater && (hold == null) === liveLater, "only the pearl set and the flag can go live later");
    assert((copy.status === "HOLD") === (hold != null) && (copy.status === "approved") === liveLater, `${copy.sku} publish status matches the file`);
    const attempt = publishListing(operatorId, {
      productId: slug,
      sku: listing.sku,
      title: listing.title,
      description: listing.description,
      priceCents: listing.priceCents,
      image: listing.image,
      supplierName: listing.supplierName,
      supplierOrigin: listing.supplierOrigin,
      shipDaysMin: 0,
      shipDaysMax: 0,
      published: true,
    });
    if (hold) {
      assert("error" in attempt && attempt.error === hold, "a held draft cannot publish");
      const held = db.prepare("SELECT published, hidden_from_shop, stock_count FROM listings WHERE product_id = ?").get(slug) as {
        published: number;
        hidden_from_shop: number;
        stock_count: number | null;
      };
      assert(held.published === 0 && held.hidden_from_shop === 1, "a held draft stays unpublished");
      db.prepare("UPDATE listings SET published = 1, hidden_from_shop = 0 WHERE product_id = ?").run(slug);
      const forced = getListing(slug);
      assert(forced != null && !visibleOnShop(forced), "a held draft stays off the shop");
      const forcedOrder = createPendingOrder({ productId: slug, qty: 1, ship: SHIP });
      assert("error" in forcedOrder && forcedOrder.error === "That page is not on the store.", "a held draft cannot be ordered");
      const after = db.prepare("SELECT stock_count FROM listings WHERE product_id = ?").get(slug) as { stock_count: number | null };
      assert(Object.is(after.stock_count, held.stock_count), "a blocked checkout does not change stock");
      for (const variant of VARIANT_STOCK[slug] ?? []) {
        const counted = db.prepare("SELECT stock_count FROM listing_stock WHERE product_id = ? AND sku = ?").get(slug, variant.sku) as {
          stock_count: number;
        };
        assert(counted.stock_count === variant.stock_count, "a blocked checkout does not change a size count");
      }
      db.prepare("UPDATE listings SET published = 0, hidden_from_shop = 1 WHERE product_id = ?").run(slug);
    } else {
      assert(!("error" in attempt) && attempt.listing?.published === true, "the pearl set and the flag are eligible to publish");
      db.prepare("UPDATE listings SET published = 0, hidden_from_shop = 1 WHERE product_id = ?").run(slug);
      const back = db.prepare("SELECT published, hidden_from_shop, stock_count FROM listings WHERE product_id = ?").get(slug) as {
        published: number;
        hidden_from_shop: number;
        stock_count: number | null;
      };
      assert(back.published === 0 && back.hidden_from_shop === 1 && Object.is(back.stock_count, STOCK[slug]), "eligibility does not publish the draft");
    }
    const flag = db.prepare("SELECT published, hidden_from_shop FROM listings WHERE product_id = ?").get(slug) as {
      published: number;
      hidden_from_shop: number;
    };
    assert(flag.published === 0 && flag.hidden_from_shop === 1, `${copy.sku} is not published`);
    rendered.push({
      name: textOf(html, "product-title"),
      price: textOf(html, "product-price"),
      description: textOf(html, "product-desc"),
    });
  }

  function stockOf(productId: string) {
    return db.prepare(
      `SELECT s.stock_count AS stockCount, l.stock_cap AS stockCap, l.published, l.hidden_from_shop AS hidden, l.sku
       FROM listings l
       LEFT JOIN listing_stock s ON s.product_id = l.product_id AND s.sku = l.sku
       WHERE l.product_id = ?`,
    ).get(productId) as { stockCount: number | null; stockCap: number; published: number; hidden: number; sku: string };
  }
  function setCount(productId: string, count: number | null) {
    const sku = stockOf(productId).sku;
    db.prepare(
      `INSERT INTO listing_stock (product_id, sku, stock_count) VALUES (?, ?, ?)
       ON CONFLICT(product_id, sku) DO UPDATE SET stock_count = excluded.stock_count`,
    ).run(productId, sku, count);
    db.prepare("UPDATE listings SET stock_count = ? WHERE product_id = ?").run(count, productId);
  }
  function variantCount(productId: string, sku: string) {
    const row = db.prepare("SELECT stock_count FROM listing_stock WHERE product_id = ? AND sku = ?").get(productId, sku) as
      | { stock_count: number | null }
      | undefined;
    return row?.stock_count;
  }
  function sell(productId: string) {
    db.prepare("UPDATE listings SET published = 1, hidden_from_shop = 0, supplier_account_id = ? WHERE product_id = ?").run(operatorId, productId);
  }
  const pearlId = "pearl-jewelry-gift-set";
  sell(pearlId);
  assert(stockOf(pearlId).stockCount === 2, "the pearl set starts at 2");
  const first = createPendingOrder({ productId: pearlId, qty: 1, ship: SHIP });
  assert(!("error" in first), "the first pearl order takes one");
  assert(stockOf(pearlId).stockCount === 1, "the pearl set decrements to 1");
  const second = createPendingOrder({ productId: pearlId, qty: 1, ship: SHIP });
  assert(!("error" in second), "the second pearl order takes the last one");
  assert(stockOf(pearlId).stockCount === 0, "the pearl set reaches 0");
  const soldListing = getListing(pearlId);
  const soldPage = soldListing ? publicShopListing(soldListing, false) : null;
  assert(soldPage?.soldOut === true && !("stockCount" in soldPage), "zero stock is sold out without a count");
  const blockedSale = createPendingOrder({ productId: pearlId, qty: 1, ship: SHIP });
  assert("error" in blockedSale && blockedSale.error === SOLD_OUT_LABEL && stockOf(pearlId).stockCount === 0, "zero stock blocks checkout");
  setCount(pearlId, 1);
  const over = createPendingOrder({ productId: pearlId, qty: 2, ship: SHIP });
  assert("error" in over && over.error === SOLD_OUT_LABEL && stockOf(pearlId).stockCount === 1, "checkout cannot take more than the stock");
  setCount(pearlId, 0);
  db.prepare("UPDATE listings SET stock_cap = 0 WHERE product_id = ?").run(pearlId);
  const legacy = getListing(pearlId);
  const legacyPage = legacy ? publicShopListing(legacy, false) : null;
  assert(legacyPage != null && legacyPage.soldOut !== true, "an uncapped listing is not sold out");
  const legacyOrder = createPendingOrder({ productId: pearlId, qty: 1, ship: SHIP });
  assert(!("error" in legacyOrder) && stockOf(pearlId).stockCount === 0 && stockOf(pearlId).stockCap === 0, "an uncapped listing does not decrement");
  db.prepare("UPDATE listings SET stock_cap = 1 WHERE product_id = ?").run(pearlId);
  setCount(pearlId, 1);
  closeDb();
  const raced = await Promise.all([raceOrder(pearlId), raceOrder(pearlId)]);
  db = openDb();
  const wins = raced.filter((item) => item.ok);
  const losses = raced.filter((item) => !item.ok);
  assert(wins.length === 1 && losses.length === 1 && losses[0]?.error === SOLD_OUT_LABEL, "one concurrent order wins and the other is sold out");
  assert(stockOf(pearlId).stockCount === 0, "the race leaves the pearl set at 0");

  const flagId = "christmas-tree-cat-house-flag";
  sell(flagId);
  assert(stockOf(flagId).stockCount === 999, "the flag starts at 999");
  setCount(flagId, null);
  const unnamed = createPendingOrder({ productId: flagId, qty: 1, ship: SHIP });
  assert("error" in unnamed && unnamed.error === "That page is not on the store." && stockOf(flagId).stockCount == null, "an unset stock count cannot be ordered");
  const flag = getListing(flagId);
  if (!flag) throw new Error("the flag listing was not stored");
  const flagInput = {
    productId: flag.productId,
    sku: flag.sku,
    title: flag.title,
    description: flag.description,
    priceCents: flag.priceCents,
    image: flag.image,
    supplierName: flag.supplierName,
    supplierOrigin: flag.supplierOrigin,
    shipDaysMin: 0,
    shipDaysMax: 0,
  };
  const counted = publishListing(operatorId, { ...flagInput, published: false, stockCount: 1 });
  assert(
    !("error" in counted) && counted.listing?.published === false && counted.listing.stockCount === 1 && counted.listing.stockCap,
    "the operator can set stock without publishing",
  );
  setCount(flagId, 4);
  const unchanged = publishListing(operatorId, { ...flagInput, published: false });
  assert(!("error" in unchanged) && stockOf(flagId).stockCount === 4, "an omitted stock count stays as the operator left it");
  const invalid = publishListing(operatorId, { ...flagInput, published: false, stockCount: -1 });
  assert("error" in invalid && invalid.error === "That page is not on the store." && stockOf(flagId).stockCount === 4, "a bad stock count is refused");
  sell(flagId);
  setCount(flagId, 1);
  db.prepare("UPDATE listings SET stock_cap = 1 WHERE product_id = ?").run(flagId);
  const flagOrder = createPendingOrder({ productId: flagId, qty: 1, ship: SHIP });
  assert(!("error" in flagOrder) && stockOf(flagId).stockCount === 0, "a counted flag decrements");
  const flagAgain = createPendingOrder({ productId: flagId, qty: 1, ship: SHIP });
  assert("error" in flagAgain && flagAgain.error === SOLD_OUT_LABEL && stockOf(flagId).stockCount === 0, "a sold-out flag cannot be ordered");

  const blueId = "insulated-dog-raincoat-dark-blue";
  sell(flagId);
  db.prepare("UPDATE listings SET size_offer = ?, stock_cap = 1 WHERE product_id = ?").run(
    JSON.stringify([
      { size: "2XS", sku: "FLAG-2XS" },
      { size: "XS", sku: "FLAG-XS" },
    ]),
    flagId,
  );
  db.prepare("INSERT INTO listing_stock (product_id, sku, stock_count) VALUES (?, 'FLAG-2XS', 30), (?, 'FLAG-XS', 41)").run(flagId, flagId);
  const missingSize = createPendingOrder({ productId: flagId, qty: 1, ship: SHIP });
  assert("error" in missingSize && missingSize.error === "That page is not on the store." && variantCount(flagId, "FLAG-2XS") === 30, "a sized listing needs a size");
  const sized = createPendingOrder({ productId: flagId, qty: 1, sku: "FLAG-2XS", ship: SHIP });
  assert(!("error" in sized) && variantCount(flagId, "FLAG-2XS") === 29 && variantCount(flagId, "FLAG-XS") === 41, "one size decrements on its own");
  const savedSku = db.prepare("SELECT variant_sku FROM orders WHERE product_id = ? ORDER BY created_at DESC LIMIT 1").get(flagId) as {
    variant_sku: string;
  };
  assert(savedSku.variant_sku === "FLAG-2XS", "the order keeps the size sku");
  db.prepare("UPDATE listing_stock SET stock_count = 0 WHERE product_id = ? AND sku = 'FLAG-2XS'").run(flagId);
  const sizeBlocked = createPendingOrder({ productId: flagId, qty: 1, sku: "FLAG-2XS", ship: SHIP });
  assert(
    "error" in sizeBlocked && sizeBlocked.error === SOLD_OUT_LABEL && variantCount(flagId, "FLAG-2XS") === 0 && variantCount(flagId, "FLAG-XS") === 41,
    "a sold-out size blocks checkout",
  );
  const otherSize = createPendingOrder({ productId: flagId, qty: 1, sku: "FLAG-XS", ship: SHIP });
  assert(!("error" in otherSize) && variantCount(flagId, "FLAG-XS") === 40, "the other size still sells");
  db.prepare("UPDATE listing_stock SET stock_count = 1 WHERE product_id = ? AND sku = 'FLAG-XS'").run(flagId);
  closeDb();
  const sizeRace = await Promise.all([raceOrder(flagId, "FLAG-XS"), raceOrder(flagId, "FLAG-XS")]);
  db = openDb();
  const sizeWins = sizeRace.filter((item) => item.ok);
  const sizeLosses = sizeRace.filter((item) => !item.ok);
  assert(sizeWins.length === 1 && sizeLosses.length === 1 && sizeLosses[0]?.error === SOLD_OUT_LABEL, "one size cannot be sold twice at once");
  assert(variantCount(flagId, "FLAG-XS") === 0 && variantCount(flagId, "FLAG-2XS") === 0, "the race leaves that size at 0");
  assert(variantCount(blueId, "GJ472F2-DB-2XS") === 30 && variantCount(blueId, "GJ472F2-DB-XS") === 41, "the raincoat counts stay on their own rows");

  const buyer = signUp({ name: "Stock Buyer", email: "stock-buyer@example.com", password: "import-test" });
  if ("error" in buyer) throw new Error(buyer.error);
  closeDb();
  const refused = setStock("stock-buyer@example.com", ["--sku", "GJ472F2-DB-2XS", "--count", "1"]);
  assert(refused.status !== 0 && refused.stderr.includes("Only an operator can set stock."), "a buyer cannot set stock");
  db = openDb();
  assert(variantCount(blueId, "GJ472F2-DB-2XS") === 30, "a refused update leaves the count");
  db.prepare("UPDATE accounts SET role = 'admin' WHERE id = ?").run(operatorId);
  db.prepare("UPDATE listings SET published = 0, hidden_from_shop = 1 WHERE product_id = ?").run(flagId);
  closeDb();
  const updated = setStock("draft-operator@example.com", ["--sku", "GJ472F2-DB-2XS", "--count", "29"]);
  if (updated.status !== 0) throw new Error(updated.stderr || updated.stdout || "stock update failed");
  assert(updated.stdout.includes("GJ472F2-DB-2XS → 29") && !updated.stdout.includes("published"), "the operator script sets one count");
  const unknown = setStock("draft-operator@example.com", ["--sku", "NO-SUCH-SKU", "--count", "1"]);
  assert(unknown.status !== 0, "an unknown sku is refused");
  const countFile = join(dirname(process.env.DATABASE_PATH ?? ""), "counts.json");
  writeFileSync(
    countFile,
    JSON.stringify([
      { sku: "GJ023S0-GREEN-XS", stock_count: 160 },
      { sku: "XV-MOD-L54", stock_count: 1000 },
    ]),
  );
  const filed = setStock("draft-operator@example.com", ["--file", countFile]);
  if (filed.status !== 0) throw new Error(filed.stderr || filed.stdout || "stock file failed");
  db = openDb();
  assert(variantCount(blueId, "GJ472F2-DB-2XS") === 29 && variantCount(blueId, "GJ472F2-DB-XS") === 41, "the script updates one raincoat size");
  assert(variantCount("reversible-dog-raincoat-green", "GJ023S0-GREEN-XS") === 160, "the stock file updates a size");
  assert(stockOf(flagId).stockCount === 1000 && stockOf(flagId).published === 0 && stockOf(blueId).published === 0, "a stock update does not publish");

  closeDb();
  const restored = runDraft(CATALOG);
  if (restored.status !== 0) throw new Error(restored.stderr || restored.stdout || "draft reimport failed");
  assert(!restored.stdout.includes("published"), "a draft reimport does not publish");
  db = openDb();
  assert(variantCount(blueId, "GJ472F2-DB-2XS") === 29, "a reimport leaves the operator count");
  assert(stockOf(flagId).stockCount === 1000 && stockOf(flagId).published === 0 && stockOf(flagId).hidden === 1, "a reimport leaves the flag unpublished");
  assert(variantCount(flagId, "FLAG-2XS") == null, "a reimport drops a size that is not in the catalog");
  for (const product of parsed.products) {
    const slug = String(product.slug);
    const row = stockOf(slug);
    assert(row.published === 0 && row.hidden === 1 && row.stockCap === 1, "a reimport keeps every draft unpublished");
    const stored = db.prepare("SELECT title, description, specs, published FROM listings WHERE product_id = ?").get(slug) as {
      title: string;
      description: string;
      specs: string;
      published: number;
    };
    const copy = copyBySku.get(String(product.sku));
    assert(
      copy != null && stored.published === 0 && stored.title === copy.title && stored.description === copy.description && stored.specs === JSON.stringify(copy.specs),
      `${product.sku} stays unpublished with the file copy`,
    );
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
  const pearlCopy = copyBySku.get("XV-MOD-L83");
  const blueCopy = copyBySku.get("XV-MOD-L47");
  if (!pearlCopy || !blueCopy) throw new Error("missing copy");
  const frameHtml = renderToStaticMarkup(createElement(ProductFrame, { src: pearl, alt: pearlCopy.title, sizes: "280px", priority: true }));
  assert(frameHtml.includes('loading="lazy"'), "a draft photo lazy-loads");
  assert(frameHtml.includes('width="1920"') && frameHtml.includes('height="1920"'), "a draft photo has fixed dimensions");
  assert(!frameHtml.includes("preload"), "a draft photo is not preloaded");
  const tileHtml = renderToStaticMarkup(createElement(MarkTile, { src: pearl, alt: "", sizes: "280px" }));
  assert(tileHtml.includes('loading="lazy"') && tileHtml.includes('width="1920"') && tileHtml.includes('height="1920"'), "a draft tile lazy-loads at a fixed size");
  const buyListing = {
    productId: pearlId,
    sku: "XV-MOD-L83",
    title: pearlCopy.title,
    description: pearlCopy.description,
    specs: pearlCopy.specs,
    priceCents: 15025,
    image: pearl,
    supplierName: "",
    supplierOrigin: "",
    shipDaysMin: 0,
    shipDaysMax: 0,
  };
  const soldBuy = renderToStaticMarkup(
    createElement(ProductBuy, { listing: { ...buyListing, soldOut: true }, returnNote: "", shareHref: "https://example.com/pearl" }),
  );
  assert(textOf(soldBuy, "product-sold-out") === approved.label && !soldBuy.includes("Continue to checkout"), "a sold-out listing shows sold out and no checkout");
  assert(textOf(soldBuy, "product-title") === pearlCopy.title && JSON.stringify(textsOf(soldBuy, "product-spec")) === JSON.stringify(pearlCopy.specs), "a sold-out listing renders the file");
  const openBuy = renderToStaticMarkup(
    createElement(ProductBuy, { listing: { ...buyListing, soldOut: false }, returnNote: "", shareHref: "https://example.com/pearl" }),
  );
  assert(!openBuy.includes("TODO(Wordy)") && openBuy.includes("Continue to checkout"), "an in-stock listing keeps checkout");
  const sizedBuy = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: {
        ...buyListing,
        productId: "insulated-dog-raincoat-dark-blue",
        sku: "XV-MOD-L47",
        title: blueCopy.title,
        description: blueCopy.description,
        specs: blueCopy.specs,
        offers: [
          { size: "2XS", sku: "GJ472F2-DB-2XS", soldOut: true },
          { size: "XS", sku: "GJ472F2-DB-XS" },
        ],
      },
      returnNote: "",
      shareHref: "https://example.com/coat",
    }),
  );
  assert(sizedBuy.includes("2XS") && sizedBuy.includes("XS") && textOf(sizedBuy, "product-sold-out") === approved.label, "a sold-out size shows sold out");
  assert(JSON.stringify(textsOf(sizedBuy, "product-spec")) === JSON.stringify(blueCopy.specs), "a sized listing renders the file");
  assert(sizedBuy.includes("Continue to checkout") && !sizedBuy.includes("30") && !sizedBuy.includes("41"), "the other size can still be bought");
  const gridHtml = renderToStaticMarkup(
    createElement(ShopGrid, {
      kicker: "Shop",
      title: "Shop",
      lede: "Goods",
      query: "",
      empty: "None",
      seed: [
        {
          productId: pearlId,
          title: pearlCopy.title,
          priceCents: 15025,
          image: pearl,
          supplierOrigin: "",
          shipDaysMin: 0,
          shipDaysMax: 0,
          soldOut: true,
        },
      ],
    }),
  );
  assert(textOf(gridHtml, "shop-card-stock") === approved.label && textOf(gridHtml, "shop-card-title") === pearlCopy.title, "a sold-out card shows sold out");
  console.log(JSON.stringify(rendered));
  console.log("modalyst draft checks ok");
  db.close();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
