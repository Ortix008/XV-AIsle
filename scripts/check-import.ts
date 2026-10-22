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

function runImport(paths: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ["scripts/catalog-import.mjs", ...paths], {
    env: {
      ...process.env,
      DATABASE_PATH: process.env.DATABASE_PATH,
      STORE_OPERATOR_EMAIL: "operator@example.com",
      IMPORT_SUPPLIER_EMAIL: "supplier@example.com",
      ...env,
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
  if (listed.supplierOrderUrl !== "https://example.invalid/hidden-source") {
    throw new Error("the supplier link should be stored from the catalog file");
  }
  if (listed.route !== "manual") throw new Error("imported listings default to the manual route");
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
    { slug: "example-loss", supplier_cost_cents: 430, supplier_shipping_cents: 0 },
  ]);
  closeDb();
  const rejected = runImport([badPublic, badPrivate]);
  if (rejected.status === 0) throw new Error("a payout under the floor should fail");
  if (rejected.stdout.includes("430")) throw new Error("stdout leaked a private field");
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

  const { GET: catalogGet } = await import("../src/app/api/store/catalog/route");
  const catalogBody = JSON.stringify(await (await catalogGet()).json());
  if (catalogBody.includes("hidden-source") || catalogBody.includes("supplier_order_url") || catalogBody.includes("supplierOrderUrl")) {
    throw new Error("the public catalog leaked the supplier link");
  }
  const { GET: listingsGet } = await import("../src/app/api/store/listings/route");
  const listingsBody = JSON.stringify(await (await listingsGet(new Request("http://127.0.0.1/api/store/listings"))).json());
  if (listingsBody.includes("hidden-source") || listingsBody.includes("supplierOrderUrl") || listingsBody.includes("supplier_email")) {
    throw new Error("the public listings leaked a supplier field");
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

  const twentyPublic = writeCatalog(dir, "twenty-public.json", [
    {
      slug: "twenty-pan",
      sku: "TW-PAN",
      title: "Twenty dollar pan",
      price_cents: 2000,
      description: "A made-up pan whose old 10% fee was the only reason it missed the floor.",
      image: "/art/products/twenty-pan.jpg",
      source_url: "https://example.invalid/twenty-hidden",
    },
  ]);
  const twentyPrivate = writeCatalog(dir, "twenty-private.json", [
    { slug: "twenty-pan", supplier_cost_cents: 1700, supplier_shipping_cents: 0 },
  ]);
  closeDb();
  const twenty = runImport([twentyPublic, twentyPrivate]);
  if (twenty.status !== 0) throw new Error(twenty.stderr || twenty.stdout || "own-store import failed");
  if (!twenty.stdout.includes("twenty-pan → published")) throw new Error("a twenty dollar own-store import clears the floor");
  if (twenty.stdout.includes("1700")) throw new Error("stdout leaked a private field");
  const twentyRow = getDb().prepare("SELECT fee_bps, account_id FROM listings WHERE product_id = 'twenty-pan'").get() as
    | { fee_bps: number | null; account_id: string }
    | undefined;
  if (!twentyRow || twentyRow.account_id !== operator.account.id) throw new Error("the twenty dollar import should be published");
  if (twentyRow.fee_bps !== 0) throw new Error("an own-store import stores a zero fee");
  console.log("pass a twenty dollar own-store import clears the floor");
  console.log("pass an own-store import stores a zero fee");

  const missedPublic = writeCatalog(dir, "missed-public.json", [
    {
      slug: "missed-pan",
      sku: "MS-PAN",
      title: "Missed pan",
      price_cents: 2000,
      description: "The same pan, imported before the operator account resolves.",
      image: "/art/products/missed-pan.jpg",
      source_url: "https://example.invalid/missed-hidden",
    },
  ]);
  const missedPrivate = writeCatalog(dir, "missed-private.json", [
    { slug: "missed-pan", supplier_cost_cents: 1700, supplier_shipping_cents: 0 },
  ]);
  closeDb();
  const unresolved = runImport([missedPublic, missedPrivate], { STORE_OPERATOR_EMAIL: "missing@example.com" });
  if (unresolved.status === 0) throw new Error("an unresolved operator should not import");
  if (!`${unresolved.stderr}${unresolved.stdout}`.includes("The operator or supplier account is not on file.")) {
    throw new Error("an unresolved operator keeps today's refusal");
  }
  if (getDb().prepare("SELECT product_id FROM listings WHERE product_id = 'missed-pan'").get()) {
    throw new Error("an unresolved operator does not import at zero fee");
  }
  console.log("pass an unresolved operator does not import at zero fee");

  closeDb();
  const unset = runImport([missedPublic, missedPrivate], { STORE_OPERATOR_EMAIL: "" });
  if (unset.status === 0) throw new Error("an unset operator email should not import");
  if (!`${unset.stderr}${unset.stdout}`.includes("Set STORE_OPERATOR_EMAIL and IMPORT_SUPPLIER_EMAIL.")) {
    throw new Error("an unset operator email keeps today's refusal");
  }
  console.log("pass an unset operator email does not import at zero fee");

  closeDb();
  console.log("import checks ok");
}

main();
