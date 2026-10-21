import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-modalyst-")), "modalyst.sqlite");
delete process.env.MODALYST_API_BASE;
delete process.env.MODALYST_API_KEY;
delete process.env.MODALYST_API_SECRET;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const pageOne = {
  products: [
    {
      id: "lantern-12",
      sku: "LANTERN-12",
      title: "Glass lantern",
      description: "A supplier lantern.",
      images: ["https://cdn.modalyst.test/lantern.jpg", "http://cdn.modalyst.test/nope.jpg"],
      wholesale_cost: "8.50",
      list_price: "24.00",
      ships_from: "Austin, TX",
      ship_days: "2–5",
    },
    {
      id: "no-days",
      title: "Missing days",
      wholesale_cost_cents: 100,
      price_cents: 500,
      ships_from: "Austin, TX",
    },
  ],
  next_cursor: "page-2",
};

const pageTwo = {
  data: {
    products: [
      {
        id: "tray-3",
        title: "Wood tray",
        images: [{ src: "https://cdn.modalyst.test/tray.jpg" }],
        cost_cents: 400,
        list_price_cents: 1800,
        origin: "Denver, CO",
        ship_days_min: 3,
        ship_days_max: 3,
      },
    ],
  },
};

const env = {
  MODALYST_API_BASE: "https://api.modalyst.test",
  MODALYST_API_KEY: "test-key",
  MODALYST_API_SECRET: "test-secret",
};

const calls: { url: string; authorization: string | null; secret: string | null }[] = [];

function mockFetch(url: URL | RequestInfo, init?: RequestInit) {
  const href = String(url);
  const headers = new Headers(init?.headers);
  calls.push({
    url: href,
    authorization: headers.get("authorization"),
    secret: headers.get("x-modalyst-api-secret"),
  });
  const body = href.includes("cursor=page-2") ? pageTwo : pageOne;
  return Promise.resolve(Response.json(body));
}

async function main() {
  const { signUp } = await import("../src/lib/server/accounts");
  const { getDb } = await import("../src/lib/server/db");
  const { getListing, listPublished } = await import("../src/lib/server/store");
  const { importModalystForAccount } = await import("../src/lib/server/modalyst-import");

  const blocked = await importModalystForAccount(
    { id: "buyer", role: "buyer" },
    { env, fetch: mockFetch },
  );
  assert(blocked.status === 403, "a buyer cannot import");
  assert(calls.length === 0, "a refused import does not call Modalyst");

  const missing = await importModalystForAccount({ id: "admin", role: "admin" }, { env: {}, fetch: mockFetch });
  assert(missing.status === 400, "missing Modalyst env is refused");
  assert(calls.length === 0, "missing credentials do not call Modalyst");

  const admin = signUp({ name: "Modalyst Admin", email: "modalyst-admin@example.com", password: "modalyst-test" });
  if ("error" in admin) throw new Error(admin.error);
  getDb().prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(admin.account.id);

  const result = await importModalystForAccount(
    { id: admin.account.id, role: "admin" },
    { env, fetch: mockFetch },
  );
  assert(result.status === 200, "the mocked import succeeds");
  assert(result.imported?.includes("lantern-12") && result.imported.includes("tray-3"), "both complete products import");
  assert(result.skipped?.some((item) => item.id === "no-days" && item.reason === "missing ship days"), "a product without ship days is skipped");
  assert(calls.length === 2, "the importer reads the next cursor page");
  assert(calls[0]?.url === "https://api.modalyst.test/v1/products", "the first request is the products path");
  assert(calls[1]?.url === "https://api.modalyst.test/v1/products?cursor=page-2", "the cursor stays on the configured origin");
  for (const call of calls) {
    assert(call.authorization === "Bearer test-key", "the key is a bearer token");
    assert(call.secret === "test-secret", "the secret is a header");
    assert(!call.url.includes("test-key") && !call.url.includes("test-secret"), "credentials stay out of the URL");
    assert(!/login|signin|sign-in|oauth|token/i.test(call.url), "the importer does not sign in");
    assert(!call.url.includes("localhost") && !call.url.includes("127.0.0.1"), "the product URL is not local");
  }

  const lantern = getListing("lantern-12");
  assert(lantern != null && lantern.published === false, "imported products stay unpublished");
  assert(lantern?.supplierUsConfirmed === false, "imported products stay unconfirmed");
  assert(lantern?.priceCents === 2400, "list price is mapped in cents");
  assert(lantern?.supplierCostCents === 850, "wholesale cost is mapped in cents");
  assert(lantern?.shipsFrom === "Austin, TX", "ship-from is mapped");
  assert(lantern?.shipDaysMin === 2 && lantern.shipDaysMax === 5, "ship days are mapped");
  assert(lantern?.title === "Glass lantern", "title is mapped");
  const images = getDb().prepare("SELECT import_images, wholesale_cost FROM listings WHERE product_id = ?").get("lantern-12") as {
    import_images: string;
    wholesale_cost: number;
  };
  assert(images.import_images === JSON.stringify(["https://cdn.modalyst.test/lantern.jpg"]), "only https images are kept");
  assert(images.wholesale_cost === 850, "wholesale cost is stored on the product");
  const tray = getListing("tray-3");
  assert(tray?.shipDaysMin === 3 && tray.shipDaysMax === 3 && tray.shipsFrom === "Denver, CO", "a single ship day and origin are mapped");
  assert(!listPublished().some((listing) => listing.productId === "lantern-12" || listing.productId === "tray-3"), "unpublished imports stay off the shop");
  assert(getListing("no-days") == null, "a skipped product is not stored");

  console.log("modalyst import checks ok");
}

main();
