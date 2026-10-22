import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const SLUG = /^[a-z0-9-]{1,60}$/;
const IMAGE = /^\/art\/products\/[a-z0-9-]+\.(jpg|png|webp)$/;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function line(slug, message) {
  const name = typeof slug === "string" && SLUG.test(slug) ? slug : "row";
  process.stdout.write(`${name} → ${message}\n`);
}

function clampedInt(raw, fallback, min, max) {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function platformFeeBps() {
  return clampedInt(process.env.PLATFORM_FEE_BPS, 1000, 800, 1200);
}

function stripeFeeBps() {
  return clampedInt(process.env.STRIPE_FEE_BPS, 290, 0, 1000);
}

function stripeFeeFixedCents() {
  return clampedInt(process.env.STRIPE_FEE_FIXED_CENTS, 30, 0, 100);
}

function minResellerNetCents() {
  return clampedInt(process.env.MIN_RESELLER_NET_CENTS, 50, 0, 5000);
}

function payoutBelowFloor(price, cost, shipping) {
  const platform = Math.round((price * platformFeeBps()) / 10000);
  const stripe = Math.round((price * stripeFeeBps()) / 10000) + stripeFeeFixedCents();
  return price - platform - stripe - cost - shipping < minResellerNetCents();
}

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 365) return null;
  return parsed;
}

function readProducts(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.products)) return null;
    return parsed.products;
  } catch {
    return null;
  }
}

function slugOf(product) {
  if (!product || typeof product !== "object") return "";
  return typeof product.slug === "string" ? product.slug : "";
}

function countSlugs(products) {
  const counts = new Map();
  for (const product of products) {
    const slug = slugOf(product);
    if (!SLUG.test(slug)) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

function httpsUrl(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 300) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function mailbox(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length > 120 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(trimmed)) return null;
  return trimmed;
}

function routeOf(value) {
  if (value === "email" || value === "api" || value === "manual") return value;
  return "manual";
}

function ensureColumn(db, table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((col) => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function buildRow(product, priv) {
  const title = typeof product.title === "string" ? product.title.trim() : "";
  if (title.length < 1 || title.length > 180) return { reason: "invalid title" };
  const sku = typeof product.sku === "string" ? product.sku.trim() : "";
  if (sku.length < 1 || sku.length > 40) return { reason: "invalid sku" };
  if (typeof product.description !== "string") return { reason: "invalid description" };
  if (product.description.length > 4000) return { reason: "description is too long" };
  if (typeof product.price_cents !== "number" || !Number.isInteger(product.price_cents) || product.price_cents < 500) {
    return { reason: "price is too low" };
  }
  if (typeof product.image !== "string" || !IMAGE.test(product.image)) return { reason: "invalid image" };
  let image = product.image;
  if (!existsSync(join("public", image.slice(1)))) {
    process.stderr.write(`warning: ${product.slug}\n`);
    image = "";
  }
  const cost = priv.supplier_cost_cents;
  const shipping = priv.supplier_shipping_cents;
  if (typeof cost !== "number" || !Number.isInteger(cost) || cost < 0) return { reason: "invalid cost" };
  if (typeof shipping !== "number" || !Number.isInteger(shipping) || shipping < 0) return { reason: "invalid shipping" };
  if (payoutBelowFloor(product.price_cents, cost, shipping)) return { reason: "payout below floor" };
  return {
    row: {
      slug: product.slug,
      title,
      sku,
      description: product.description.trim(),
      priceCents: product.price_cents,
      image,
      costCents: cost,
      shippingCents: shipping,
      route: routeOf(priv.route),
      supplierOrderUrl: httpsUrl(priv.source_url) ?? httpsUrl(product.source_url),
      supplierEmail: mailbox(priv.supplier_email),
    },
  };
}

function accountByEmail(db, email) {
  return db.prepare("SELECT id, name, role FROM accounts WHERE email = ?").get(email);
}

const DRAFT_KEYS = new Set(["slug", "title", "sku", "description", "specs", "price_cents", "image", "variants", "stock_count"]);

const RAINCOAT_VARIANTS = {
  "insulated-dog-raincoat-dark-blue": [
    { size: "2XS", sku: "GJ472F2-DB-2XS" },
    { size: "XS", sku: "GJ472F2-DB-XS" },
  ],
  "reversible-dog-raincoat-green": [
    { size: "2XS", sku: "GJ023S0-GREEN-2XS" },
    { size: "XS", sku: "GJ023S0-GREEN-XS" },
  ],
};

function sameOffer(value, expected) {
  if (!Array.isArray(value) || value.length !== expected.length) return false;
  return expected.every((item, index) => {
    const got = value[index];
    if (!got || typeof got !== "object") return false;
    const keys = Object.keys(got);
    if (keys.length !== 3 || !keys.includes("size") || !keys.includes("sku") || !keys.includes("stock_count")) return false;
    return got.size === item.size && got.sku === item.sku;
  });
}

function stockCountOf(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return value;
}

function draftSpecs(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 12) return null;
  const specs = [];
  for (const item of value) {
    if (typeof item !== "string" || item.length < 1 || item.length > 400 || item !== item.trim()) return null;
    specs.push(item);
  }
  return specs;
}

function buildDraftRow(product) {
  const title = typeof product.title === "string" ? product.title.trim() : "";
  if (title.length < 1 || title.length > 180) return { reason: "invalid title" };
  const sku = typeof product.sku === "string" ? product.sku.trim() : "";
  if (sku.length < 1 || sku.length > 40) return { reason: "invalid sku" };
  if (typeof product.description !== "string") return { reason: "invalid description" };
  if (product.description.length > 4000) return { reason: "description is too long" };
  if (typeof product.price_cents !== "number" || !Number.isInteger(product.price_cents) || product.price_cents < 500) {
    return { reason: "price is too low" };
  }
  if (typeof product.image !== "string" || !IMAGE.test(product.image)) return { reason: "invalid image" };
  if (product.image !== `/art/products/${product.slug}.jpg`) return { reason: "invalid image" };
  const extra = Object.keys(product).find((key) => !DRAFT_KEYS.has(key));
  if (extra) return { reason: "private field" };
  const specs = draftSpecs(product.specs);
  if (!specs) return { reason: "invalid specs" };
  const expectedSizes = RAINCOAT_VARIANTS[product.slug] ?? null;
  let sizeOffer = null;
  let stockCount = null;
  let counts = [];
  if (expectedSizes) {
    if (Object.hasOwn(product, "stock_count")) return { reason: "invalid stock" };
    if (!sameOffer(product.variants, expectedSizes)) return { reason: "invalid sizes" };
    for (const item of product.variants) {
      const count = stockCountOf(item.stock_count);
      if (count == null) return { reason: "invalid stock" };
      counts.push({ sku: item.sku, stockCount: count });
    }
    sizeOffer = JSON.stringify(expectedSizes);
  } else {
    if (product.variants != null) return { reason: "invalid sizes" };
    if (!Object.hasOwn(product, "stock_count")) return { reason: "missing stock" };
    const count = stockCountOf(product.stock_count);
    if (count == null) return { reason: "invalid stock" };
    stockCount = count;
    counts = [{ sku, stockCount: count }];
  }
  return {
    row: {
      slug: product.slug,
      title,
      sku,
      description: product.description.trim(),
      specs: JSON.stringify(specs),
      priceCents: product.price_cents,
      image: product.image,
      sizeOffer,
      stockCount,
      counts,
    },
  };
}

function importDraft(file, dryRun) {
  const operatorEmail = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase() ?? "";
  if (!operatorEmail) {
    fail("Set STORE_OPERATOR_EMAIL.");
    return;
  }
  const products = readProducts(file);
  if (!products) {
    fail("The catalog file could not be read.");
    return;
  }
  const counts = countSlugs(products);
  const skipped = [];
  const ready = [];
  const seen = new Set();
  for (const product of products) {
    const slug = slugOf(product);
    if (!SLUG.test(slug)) {
      skipped.push({ slug: "row", reason: "invalid slug" });
      continue;
    }
    if (counts.get(slug) > 1) {
      if (!seen.has(slug)) skipped.push({ slug, reason: "duplicate slug" });
      seen.add(slug);
      continue;
    }
    seen.add(slug);
    const built = buildDraftRow(product);
    if (built.reason) skipped.push({ slug, reason: built.reason });
    else ready.push(built.row);
  }

  const path = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";
  let db;
  try {
    db = new DatabaseSync(path);
  } catch {
    fail("The store database could not be opened.");
    return;
  }
  const operator = accountByEmail(db, operatorEmail);
  if (!operator) {
    fail("The operator account is not on file.");
    db.close();
    return;
  }

  const ownerStmt = db.prepare("SELECT account_id FROM listings WHERE product_id = ?");
  const blocked = new Set();
  for (const row of ready) {
    const existing = ownerStmt.get(row.slug);
    if (existing && existing.account_id !== operator.id) {
      skipped.push({ slug: row.slug, reason: "belongs to another account" });
      blocked.add(row.slug);
    }
  }
  const accepted = ready.filter((row) => !blocked.has(row.slug));
  if (skipped.length > 0) {
    for (const item of skipped) line(item.slug, `skipped: ${item.reason}`);
    for (const row of accepted) line(row.slug, "skipped: run aborted");
    process.exitCode = 1;
    db.close();
    return;
  }
  if (dryRun) {
    for (const row of accepted) line(row.slug, "hidden");
    db.close();
    return;
  }

  ensureColumn(db, "listings", "made_in_usa", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "listings", "hidden_from_shop", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "listings", "supplier_us_confirmed", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "listings", "route", "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, "listings", "supplier_order_url", "TEXT");
  ensureColumn(db, "listings", "supplier_email", "TEXT");
  ensureColumn(db, "listings", "supplier_cost_cents", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "listings", "supplier_shipping_cents", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "listings", "catalog_item_id", "TEXT");
  ensureColumn(db, "listings", "size_offer", "TEXT");
  ensureColumn(db, "listings", "stock_count", "INTEGER");
  ensureColumn(db, "listings", "stock_cap", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "listings", "specs", "TEXT");

  const insertListing = db.prepare(
    `INSERT INTO listings (
       product_id, account_id, sku, title, description, price_cents, image,
       supplier_name, supplier_origin, ship_days_min, ship_days_max, published,
       made_in_usa, hidden_from_shop, supplier_us_confirmed,
       route, supplier_order_url, supplier_email,
       supplier_cost_cents, supplier_shipping_cents, catalog_item_id, size_offer, stock_count, specs, stock_cap
     ) VALUES (?, ?, ?, ?, ?, ?, ?, '', '', 0, 0, 0, 0, 1, 0, '', NULL, NULL, 0, 0, NULL, ?, ?, ?, 1)
     ON CONFLICT(product_id) DO UPDATE SET
       account_id = excluded.account_id,
       sku = excluded.sku,
       title = excluded.title,
       description = excluded.description,
       price_cents = excluded.price_cents,
       image = excluded.image,
       supplier_name = '',
       supplier_origin = '',
       ship_days_min = 0,
       ship_days_max = 0,
       published = 0,
       made_in_usa = 0,
       hidden_from_shop = 1,
       supplier_us_confirmed = 0,
       route = '',
       supplier_order_url = NULL,
       supplier_email = NULL,
       supplier_cost_cents = 0,
       supplier_shipping_cents = 0,
       catalog_item_id = NULL,
       size_offer = excluded.size_offer,
       specs = excluded.specs,
       stock_count = listings.stock_count,
       stock_cap = 1`,
  );
  db.exec(`CREATE TABLE IF NOT EXISTS listing_stock (
    product_id TEXT NOT NULL,
    sku TEXT NOT NULL,
    stock_count INTEGER,
    PRIMARY KEY (product_id, sku)
  )`);
  const insertStock = db.prepare(
    `INSERT INTO listing_stock (product_id, sku, stock_count) VALUES (?, ?, ?)
     ON CONFLICT(product_id, sku) DO NOTHING`,
  );
  const catalogTable = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'supplier_catalog'").get();
  const clearCatalog = catalogTable ? db.prepare("DELETE FROM supplier_catalog WHERE id = ?") : null;

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const row of accepted) {
      const existing = ownerStmt.get(row.slug);
      if (existing && existing.account_id !== operator.id) {
        const owned = new Error("owned");
        owned.slug = row.slug;
        throw owned;
      }
      insertListing.run(
        row.slug,
        operator.id,
        row.sku,
        row.title,
        row.description,
        row.priceCents,
        row.image,
        row.sizeOffer,
        row.stockCount,
        row.specs,
      );
      const skuList = row.counts.map((count) => count.sku);
      db.prepare(
        `DELETE FROM listing_stock WHERE product_id = ? AND sku NOT IN (${skuList.map(() => "?").join(", ")})`,
      ).run(row.slug, ...skuList);
      for (const count of row.counts) insertStock.run(row.slug, count.sku, count.stockCount);
      clearCatalog?.run(`import-${row.slug}`);
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    if (error instanceof Error && error.slug) {
      line(error.slug, "skipped: belongs to another account");
      for (const row of accepted) {
        if (row.slug !== error.slug) line(row.slug, "skipped: run aborted");
      }
    } else {
      fail("The catalog was not written.");
    }
    process.exitCode = 1;
    db.close();
    return;
  }

  for (const row of accepted) line(row.slug, "hidden");
  db.close();
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const draft = process.argv.includes("--draft");
  const args = process.argv.slice(2).filter((arg) => arg !== "--dry-run" && arg !== "--draft");
  if (draft) {
    if (args.length !== 1) {
      fail("Pass the public JSON path.");
      return;
    }
    importDraft(args[0], dryRun);
    return;
  }
  if (args.length !== 2) {
    fail("Pass the public JSON path and the private JSON path.");
    return;
  }

  const operatorEmail = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase() ?? "";
  const supplierEmail = process.env.IMPORT_SUPPLIER_EMAIL?.trim().toLowerCase() ?? "";
  if (!operatorEmail || !supplierEmail) {
    fail("Set STORE_OPERATOR_EMAIL and IMPORT_SUPPLIER_EMAIL.");
    return;
  }
  if (operatorEmail === supplierEmail) {
    fail("The supplier has to be a different account from the operator.");
    return;
  }

  const shipMin = envInt("IMPORT_SHIP_DAYS_MIN", 3);
  const shipMax = envInt("IMPORT_SHIP_DAYS_MAX", 8);
  if (shipMin == null || shipMax == null || shipMin > shipMax) {
    fail("Ship days must be whole numbers from 0 to 365, with the minimum first.");
    return;
  }
  const origin = process.env.IMPORT_SUPPLIER_ORIGIN?.trim() || "US";
  if (origin.length > 120) {
    fail("The supplier origin is too long.");
    return;
  }

  const publicProducts = readProducts(args[0]);
  const privateProducts = readProducts(args[1]);
  if (!publicProducts || !privateProducts) {
    fail("The catalog file could not be read.");
    return;
  }

  const publicCounts = countSlugs(publicProducts);
  const privateCounts = countSlugs(privateProducts);
  const privateBySlug = new Map();
  const skipped = [];
  const ready = [];
  const seenPublic = new Set();

  for (const product of privateProducts) {
    const slug = slugOf(product);
    if (!SLUG.test(slug)) {
      skipped.push({ slug: "row", reason: "invalid slug" });
      continue;
    }
    if (!privateBySlug.has(slug)) privateBySlug.set(slug, product);
  }

  for (const product of publicProducts) {
    const slug = slugOf(product);
    if (!SLUG.test(slug)) {
      skipped.push({ slug: "row", reason: "invalid slug" });
      continue;
    }
    if (publicCounts.get(slug) > 1) {
      if (!seenPublic.has(slug)) skipped.push({ slug, reason: "duplicate slug" });
      seenPublic.add(slug);
      continue;
    }
    seenPublic.add(slug);
    if ((privateCounts.get(slug) ?? 0) > 1) {
      skipped.push({ slug, reason: "duplicate slug" });
      continue;
    }
    const priv = privateBySlug.get(slug);
    if (!priv) {
      skipped.push({ slug, reason: "no private row" });
      continue;
    }
    const built = buildRow(product, priv);
    if (built.reason) skipped.push({ slug, reason: built.reason });
    else ready.push(built.row);
  }

  for (const [slug, count] of privateCounts) {
    if (publicCounts.has(slug)) continue;
    skipped.push({ slug, reason: count > 1 ? "duplicate slug" : "no public row" });
  }

  const path = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";
  let db;
  try {
    db = new DatabaseSync(path);
  } catch {
    fail("The store database could not be opened.");
    return;
  }

  const operator = accountByEmail(db, operatorEmail);
  const supplier = accountByEmail(db, supplierEmail);
  if (!operator || !supplier) {
    fail("The operator or supplier account is not on file.");
    db.close();
    return;
  }
  if (operator.id === supplier.id) {
    fail("The supplier has to be a different account from the operator.");
    db.close();
    return;
  }
  if (supplier.role === "admin" || supplier.role === "reseller") {
    fail("The supplier account cannot be an admin or a reseller.");
    db.close();
    return;
  }
  if (supplier.role !== "buyer" && supplier.role !== "supplier") {
    fail("The supplier account cannot take a catalog.");
    db.close();
    return;
  }

  const ownerStmt = db.prepare("SELECT account_id FROM listings WHERE product_id = ?");
  const blocked = new Set();
  for (const row of ready) {
    const existing = ownerStmt.get(row.slug);
    if (existing && existing.account_id !== operator.id) {
      skipped.push({ slug: row.slug, reason: "belongs to another account" });
      blocked.add(row.slug);
    }
  }
  const accepted = ready.filter((row) => !blocked.has(row.slug));

  if (skipped.length > 0) {
    for (const item of skipped) line(item.slug, `skipped: ${item.reason}`);
    for (const row of accepted) line(row.slug, "skipped: run aborted");
    process.exitCode = 1;
    db.close();
    return;
  }

  if (dryRun) {
    for (const row of accepted) line(row.slug, "published");
    db.close();
    return;
  }

  ensureColumn(db, "listings", "route", "TEXT NOT NULL DEFAULT 'manual'");
  ensureColumn(db, "listings", "supplier_order_url", "TEXT");
  ensureColumn(db, "listings", "supplier_email", "TEXT");

  const feeBps = platformFeeBps();
  const insertCatalog = db.prepare(
    `INSERT INTO supplier_catalog (
       id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
     ON CONFLICT(id) DO UPDATE SET
       account_id = excluded.account_id,
       sku = excluded.sku,
       title = excluded.title,
       cost_cents = excluded.cost_cents,
       shipping_cents = excluded.shipping_cents,
       origin = excluded.origin,
       approved = 1`,
  );
  const insertListing = db.prepare(
    `INSERT INTO listings (
       product_id, account_id, sku, title, description, price_cents, image,
       supplier_name, supplier_origin, ship_days_min, ship_days_max, published,
       made_in_usa, shelf, supplier_account_id, supplier_cost_cents, supplier_shipping_cents, fee_bps,
       catalog_item_id, route, supplier_order_url, supplier_email
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(product_id) DO UPDATE SET
       account_id = excluded.account_id,
       sku = excluded.sku,
       title = excluded.title,
       description = excluded.description,
       price_cents = excluded.price_cents,
       image = excluded.image,
       supplier_name = excluded.supplier_name,
       supplier_origin = excluded.supplier_origin,
       ship_days_min = excluded.ship_days_min,
       ship_days_max = excluded.ship_days_max,
       published = excluded.published,
       made_in_usa = excluded.made_in_usa,
       shelf = excluded.shelf,
       supplier_account_id = excluded.supplier_account_id,
       supplier_cost_cents = excluded.supplier_cost_cents,
       supplier_shipping_cents = excluded.supplier_shipping_cents,
       fee_bps = excluded.fee_bps,
       catalog_item_id = excluded.catalog_item_id,
       route = excluded.route,
       supplier_order_url = COALESCE(excluded.supplier_order_url, listings.supplier_order_url),
       supplier_email = COALESCE(excluded.supplier_email, listings.supplier_email)`,
  );

  db.exec("BEGIN IMMEDIATE");
  try {
    if (supplier.role === "buyer") {
      db.prepare("UPDATE accounts SET role = 'supplier' WHERE id = ? AND role = 'buyer'").run(supplier.id);
    }
    for (const row of accepted) {
      const existing = ownerStmt.get(row.slug);
      if (existing && existing.account_id !== operator.id) {
        const owned = new Error("owned");
        owned.slug = row.slug;
        throw owned;
      }
      const now = Date.now();
      insertCatalog.run(
        `import-${row.slug}`,
        supplier.id,
        row.sku,
        row.title,
        row.costCents,
        row.shippingCents,
        origin,
        now,
      );
      insertListing.run(
        row.slug,
        operator.id,
        row.sku,
        row.title,
        row.description,
        row.priceCents,
        row.image,
        supplier.name,
        origin,
        shipMin,
        shipMax,
        1,
        0,
        "national",
        supplier.id,
        row.costCents,
        row.shippingCents,
        feeBps,
        `import-${row.slug}`,
        row.route,
        row.supplierOrderUrl,
        row.supplierEmail,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // The transaction is already closed.
    }
    if (error instanceof Error && error.slug) {
      line(error.slug, "skipped: belongs to another account");
      for (const row of accepted) {
        if (row.slug !== error.slug) line(row.slug, "skipped: run aborted");
      }
    } else {
      fail("The catalog was not written.");
    }
    process.exitCode = 1;
    db.close();
    return;
  }

  for (const row of accepted) line(row.slug, "published");
  db.close();
}

main();
