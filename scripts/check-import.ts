import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-import-")), "import.sqlite");

function writeCatalog(dir: string, name: string, products: unknown) {
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify({ products }));
  return path;
}

function runImport(paths: string[]) {
  return spawnSync(process.execPath, ["scripts/catalog-import.mjs", ...paths], {
    env: {
      ...process.env,
      DATABASE_PATH: process.env.DATABASE_PATH,
      STORE_OPERATOR_EMAIL: "operator@example.com",
      IMPORT_SUPPLIER_EMAIL: "supplier@example.com",
    },
    encoding: "utf8",
  });
}

async function main() {
  // Deferred until DATABASE_PATH is set. The db module reads that path the first time it opens.
  const { signUp } = await import("../src/lib/server/accounts");
  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { listingLoss, listPublished } = await import("../src/lib/server/store");

  const operator = signUp({ name: "Example Operator", email: "operator@example.com", password: "import-test" });
  if ("error" in operator) throw new Error(operator.error);
  const supplier = signUp({ name: "Example Supplier", email: "supplier@example.com", password: "import-test" });
  if ("error" in supplier) throw new Error(supplier.error);

  const dir = mkdtempSync(join(tmpdir(), "xvaisle-import-json-"));
  const publicPath = writeCatalog(dir, "public.json", [
    {
      slug: "example-pan",
      sku: "EX-PAN",
      title: "Example sheet pan",
      price_cents: 5000,
      description: "A made-up pan for the import check.",
      image: "/art/products/example-pan.jpg",
      source_url: "https://example.invalid/hidden-source",
    },
  ]);
  const privatePath = writeCatalog(dir, "private.json", [
    { slug: "example-pan", supplier_cost_cents: 812, supplier_shipping_cents: 263 },
  ]);

  closeDb();
  const imported = runImport([publicPath, privatePath]);
  if (imported.status !== 0) throw new Error(imported.stderr || imported.stdout || "import failed");
  if (!imported.stdout.includes("example-pan → published")) throw new Error("missing published line");
  if (imported.stdout.includes("812") || imported.stdout.includes("263") || imported.stdout.includes("hidden-source")) {
    throw new Error("stdout leaked a private field");
  }

  const listed = listPublished().find((item) => item.productId === "example-pan");
  if (!listed || listed.accountId !== operator.account.id) throw new Error("listing should be published");
  const loss = listingLoss(listed);
  if (loss) throw new Error("imported listing should clear the payout floor");

  const beforeListings = Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM listings").get() as { n: number | bigint }).n,
  );
  const beforeCatalog = Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM supplier_catalog").get() as { n: number | bigint }).n,
  );

  const badPublic = writeCatalog(dir, "bad-public.json", [
    {
      slug: "example-loss",
      sku: "EX-LOSS",
      title: "Example loss",
      price_cents: 500,
      description: "A made-up row under the payout floor.",
      image: "/art/products/example-loss.jpg",
      source_url: "https://example.invalid/also-hidden",
    },
  ]);
  const badPrivate = writeCatalog(dir, "bad-private.json", [
    { slug: "example-loss", supplier_cost_cents: 400, supplier_shipping_cents: 0 },
  ]);
  closeDb();
  const rejected = runImport([badPublic, badPrivate]);
  if (rejected.status === 0) throw new Error("a payout under the floor should fail");
  if (rejected.stdout.includes("400")) throw new Error("stdout leaked a private field");
  const afterListings = Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM listings").get() as { n: number | bigint }).n,
  );
  const afterCatalog = Number(
    (getDb().prepare("SELECT COUNT(*) AS n FROM supplier_catalog").get() as { n: number | bigint }).n,
  );
  if (afterListings !== beforeListings || afterCatalog !== beforeCatalog) throw new Error("a failed import wrote rows");
  if (getDb().prepare("SELECT product_id FROM listings WHERE product_id = 'example-loss'").get()) {
    throw new Error("the under-floor row was written");
  }

  const dryPublic = writeCatalog(dir, "dry-public.json", [
    {
      slug: "example-dry",
      sku: "EX-DRY",
      title: "Example dry run",
      price_cents: 2500,
      description: "A made-up row that must not be saved.",
      image: "/art/products/example-dry.jpg",
      source_url: "https://example.invalid/dry-hidden",
    },
  ]);
  const dryPrivate = writeCatalog(dir, "dry-private.json", [
    { slug: "example-dry", supplier_cost_cents: 919, supplier_shipping_cents: 40 },
  ]);
  closeDb();
  const dry = runImport(["--dry-run", dryPublic, dryPrivate]);
  if (dry.status !== 0) throw new Error(dry.stderr || dry.stdout || "dry run failed");
  if (!dry.stdout.includes("example-dry → published")) throw new Error("dry run should report the row");
  if (dry.stdout.includes("919")) throw new Error("stdout leaked a private field");
  if (getDb().prepare("SELECT product_id FROM listings WHERE product_id = 'example-dry'").get()) {
    throw new Error("dry run wrote a listing");
  }

  const { GET } = await import("../src/app/api/supplier/catalog/route");
  const response = await GET();
  if (response.status !== 401) throw new Error("catalog GET without a cookie should be 401");

  const { POST } = await import("../src/app/api/store/listings/quote/route");
  const { SESSION_COOKIE } = await import("../src/lib/server/session-cookie");
  const buyerQuote = await POST(
    new Request("http://127.0.0.1/api/store/listings/quote", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${operator.token}` },
      body: JSON.stringify({ catalogItemId: "import-example-pan", priceCents: 5000 }),
    }),
  );
  if (buyerQuote.status !== 403) throw new Error("a buyer should not receive a supplier quote");

  closeDb();
  console.log("import checks ok");
}

main();
