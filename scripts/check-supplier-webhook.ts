import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-supplier-webhook-")), "market.sqlite");
process.env.APP_URL = "https://xvaisle.com";
process.env.SUPPORT_EMAIL = "support@example.test";
delete process.env.SMTP_HOST;
delete process.env.MAIL_FROM;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_WEBHOOK_SECRET;
delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
delete process.env.TRUST_PROXY;

const SECRET = "test-supplier-webhook-secret";
process.env.SUPPLIER_WEBHOOK_SECRET = SECRET;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function setNodeEnv(value: string) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function sign(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { timestamp, v1, header: `t=${timestamp},v1=${v1}` };
}

function deliveryNote(orderId: string, supplierAccountId: string, tracking = "1Z999AA10123456787") {
  return JSON.stringify({
    orderId,
    supplierAccountId,
    carrier: "UPS",
    tracking,
    delivered: false,
  });
}

function catalogBody(sku: string) {
  return JSON.stringify({
    sku,
    title: "Quarter sheet pan",
    costCents: 500,
    shippingCents: 100,
    origin: "Elizabeth, NJ",
  });
}

type JsonBody = {
  error?: string;
  item?: { sku?: string };
  order?: { status?: string } | null;
};

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return { status: response.status, text, body: JSON.parse(text) as JsonBody | null };
  } catch {
    return { status: response.status, text, body: null };
  }
}

async function main() {
  setNodeEnv("production");
  const logs: string[] = [];
  const write = console.log;
  const info = console.info;
  const warn = console.warn;
  const error = console.error;
  const capture = (...args: unknown[]) => {
    logs.push(args.map((part) => String(part)).join(" "));
  };
  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;

  try {
    const { NextRequest } = await import("next/server");
    const { proxy } = await import("../src/proxy");
    const { SESSION_COOKIE } = await import("../src/lib/server/session-cookie");
    const { SUPPLIER_SIGNATURE_HEADER } = await import("../src/lib/server/supplier-webhook");
    const { POST: deliver } = await import("../src/app/api/supplier/delivered/route");
    const { POST: catalog } = await import("../src/app/api/supplier/catalog/route");
    const { POST: billing } = await import("../src/app/api/billing/webhook/route");
    const { POST: connect } = await import("../src/app/api/connect/webhook/route");
    const { signUp, setOwnRole } = await import("../src/lib/server/accounts");
    const { getDb } = await import("../src/lib/server/db");
    const { rotateSupplierSecret } = await import("../src/lib/server/supplier-secret");

    function proxyPost(path: string) {
      return proxy(new NextRequest(`https://xvaisle.com${path}`, { method: "POST" }));
    }

    const deliveredProxy = proxyPost("/api/supplier/delivered");
    const catalogProxy = proxyPost("/api/supplier/catalog");
    assert(deliveredProxy.status >= 200 && deliveredProxy.status < 300, "a delivery callback without Origin is not refused");
    assert(catalogProxy.status >= 200 && catalogProxy.status < 300, "a catalog callback without Origin is not refused");
    assert(proxyPost("/api/account/signin").status === 403, "another POST without Origin is still refused");
    assert(proxyPost("/api/supplier/secret").status === 403, "rotating a supplier secret still requires the app Origin");
    assert(proxyPost("/api/supplier/catalog/review").status === 403, "catalog review still requires the app Origin");
    assert(proxyPost("/api/billing/webhook").status >= 200 && proxyPost("/api/billing/webhook").status < 300, "the Stripe webhook stays open");
    assert(proxyPost("/api/connect/webhook").status >= 200 && proxyPost("/api/connect/webhook").status < 300, "the Connect webhook stays open");

    process.env.STRIPE_WEBHOOK_SECRET = "stripe-test-secret";
    const stripeBad = await readJson(
      await billing(new Request("https://xvaisle.com/api/billing/webhook", { method: "POST", body: "{}" })),
    );
    assert(stripeBad.status === 400, "the Stripe webhook still rejects a bad signature with 400");
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const stripeUnset = await readJson(
      await billing(new Request("https://xvaisle.com/api/billing/webhook", { method: "POST", body: "{}" })),
    );
    assert(stripeUnset.status === 503, "the Stripe webhook still fails closed when its secret is unset");
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "stripe-connect-test-secret";
    const connectBad = await readJson(
      await connect(new Request("https://xvaisle.com/api/connect/webhook", { method: "POST", body: "{}" })),
    );
    assert(connectBad.status === 400, "the Connect webhook still rejects a bad signature with 400");
    delete process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

    const buyer = signUp({ name: "Buyer", email: "buyer-callback@xvaisle.test", password: "market-test" });
    const supplier = signUp({ name: "Supplier", email: "supplier-callback@xvaisle.test", password: "market-test" });
    if ("error" in buyer || "error" in supplier) throw new Error("accounts");
    const role = setOwnRole(supplier.account.id, "supplier");
    if ("error" in role) throw new Error(role.error);
    const rotated = rotateSupplierSecret(supplier.account.id);
    if ("error" in rotated) throw new Error(rotated.error);

    const orderId = randomUUID();
    getDb()
      .prepare(
        `INSERT INTO orders (
           id, number, product_id, account_id, customer_name, email, qty, amount_cents,
           ship_line1, ship_city, ship_region, ship_postal, ship_country, status, created_at, supplier_account_id
         ) VALUES (?, 'XV-8844', 'sheet-pan', ?, 'Example Buyer', 'buyer@example.com', 1, 2695,
           '100 Example Street', 'Sample City', 'ST', '00000', 'US', 'ordered', ?, ?)`,
      )
      .run(orderId, buyer.account.id, Date.now(), supplier.account.id);

    function orderRow() {
      return getDb().prepare("SELECT status, tracking_number FROM orders WHERE id = ?").get(orderId) as {
        status: string;
        tracking_number: string | null;
      };
    }

    async function postDelivery(raw: string, headers: Record<string, string>) {
      return readJson(
        await deliver(
          new Request("https://xvaisle.com/api/supplier/delivered", {
            method: "POST",
            headers,
            body: raw,
          }),
        ),
      );
    }

    const raw = deliveryNote(orderId, supplier.account.id);
    const missing = await postDelivery(raw, { "x-supplier-secret": rotated.secret });
    assert(missing.status === 401, "a delivery note without a signature is refused");
    assert(!missing.text.includes(SECRET), "a refusal does not include the webhook secret");
    assert(orderRow().status === "ordered", "a missing signature does not mark the order shipped");

    const bad = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: sign(raw, "other-secret").header,
    });
    assert(bad.status === 401, "a delivery note with a bad signature is refused");
    assert(orderRow().status === "ordered", "a bad signature does not mark the order shipped");

    const shortSig = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: `t=${Math.floor(Date.now() / 1000)},v1=abc`,
    });
    assert(shortSig.status === 401, "a short signature is refused");

    const stale = sign(raw, SECRET, Math.floor(Date.now() / 1000) - 301);
    const replay = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: stale.header,
    });
    assert(replay.status === 401, "a signature older than five minutes is refused");

    const ahead = sign(raw, SECRET, Math.floor(Date.now() / 1000) + 301);
    const future = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: ahead.header,
    });
    assert(future.status === 401, "a signature from more than five minutes ahead is refused");

    const signed = sign(raw, SECRET, Math.floor(Date.now() / 1000) - 120);
    delete process.env.SUPPLIER_WEBHOOK_SECRET;
    const unset = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: signed.header,
    });
    assert(unset.status === 503, "delivery callbacks fail closed when the webhook secret is unset");
    assert(orderRow().status === "ordered", "an unset secret does not mark the order shipped");
    process.env.SUPPLIER_WEBHOOK_SECRET = "   ";
    const blank = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: signed.header,
    });
    assert(blank.status === 503, "a blank webhook secret fails closed");
    process.env.SUPPLIER_WEBHOOK_SECRET = SECRET;

    const wrongAccountSecret = await postDelivery(raw, {
      "x-supplier-secret": "not-the-supplier-secret",
      [SUPPLIER_SIGNATURE_HEADER]: signed.header,
    });
    assert(wrongAccountSecret.status === 403, "the per-account delivery secret is still required");
    assert(orderRow().status === "ordered", "a bad delivery secret does not mark the order shipped");

    const tampered = await postDelivery(`${raw} `, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: signed.header,
    });
    assert(tampered.status === 401, "the signature is over the raw body");

    const both = `t=${signed.timestamp},v1=${"ab".repeat(32)},v1=${signed.v1}`;
    const accepted = await postDelivery(raw, {
      "x-supplier-secret": rotated.secret,
      [SUPPLIER_SIGNATURE_HEADER]: both,
    });
    assert(accepted.status === 200, "a valid signature returns 2xx with no Origin");
    assert(orderRow().status === "shipped" && orderRow().tracking_number === "1Z999AA10123456787", "the delivery note is applied");

    async function postCatalog(rawBody: string, headers: Record<string, string>) {
      return readJson(
        await catalog(
          new Request("https://xvaisle.com/api/supplier/catalog", {
            method: "POST",
            headers,
            body: rawBody,
          }),
        ),
      );
    }

    function catalogCount() {
      const row = getDb().prepare("SELECT COUNT(*) AS n FROM supplier_catalog").get() as { n: number };
      return Number(row.n);
    }

    const session = { cookie: `${SESSION_COOKIE}=${supplier.token}` };
    const first = catalogBody("PAN-CB-1");
    const signedCatalog = sign(first, SECRET);
    const created = await postCatalog(first, { ...session, [SUPPLIER_SIGNATURE_HEADER]: signedCatalog.header });
    assert(created.status === 200 && created.body?.item?.sku === "PAN-CB-1", "a signed catalog post returns 2xx with no Origin");

    const beforeMissing = catalogCount();
    const missingCatalog = await postCatalog(catalogBody("PAN-CB-2"), session);
    assert(missingCatalog.status === 401, "a catalog callback without a signature is refused");
    assert(catalogCount() === beforeMissing, "a missing catalog signature stores nothing");

    const badCatalog = await postCatalog(catalogBody("PAN-CB-3"), {
      ...session,
      [SUPPLIER_SIGNATURE_HEADER]: sign(catalogBody("PAN-CB-3"), "other-secret").header,
    });
    assert(badCatalog.status === 401, "a catalog callback with a bad signature is refused");

    const anonymous = await postCatalog(first, { [SUPPLIER_SIGNATURE_HEADER]: signedCatalog.header });
    assert(anonymous.status === 401, "a signed catalog post still requires the supplier session");

    delete process.env.SUPPLIER_WEBHOOK_SECRET;
    const beforeUnset = catalogCount();
    const unsetCatalog = await postCatalog(catalogBody("PAN-CB-4"), {
      ...session,
      [SUPPLIER_SIGNATURE_HEADER]: sign(catalogBody("PAN-CB-4"), SECRET).header,
    });
    assert(unsetCatalog.status === 503, "catalog callbacks fail closed when the webhook secret is unset");
    assert(catalogCount() === beforeUnset, "an unset secret stores no catalog item");

    const browser = await postCatalog(catalogBody("PAN-CB-5"), { ...session, origin: "https://xvaisle.com" });
    assert(browser.status === 200 && browser.body?.item?.sku === "PAN-CB-5", "the supplier form still posts from the app origin");
    const referred = await postCatalog(catalogBody("PAN-CB-6"), {
      ...session,
      referer: "https://xvaisle.com/account",
    });
    assert(referred.status === 200, "Referer still stands in for a missing Origin on the supplier form");
    process.env.SUPPLIER_WEBHOOK_SECRET = SECRET;
    const beforeForeign = catalogCount();
    const foreign = await postCatalog(catalogBody("PAN-CB-7"), { ...session, origin: "https://evil.example" });
    assert(foreign.status === 401, "a foreign Origin cannot skip the signature");
    assert(catalogCount() === beforeForeign, "a foreign Origin stores nothing");
    const browserWithSecret = await postCatalog(catalogBody("PAN-CB-8"), { ...session, origin: "https://xvaisle.com" });
    assert(browserWithSecret.status === 200, "the supplier form still posts after the webhook secret is set");

    assert(!logs.some((line) => line.includes(SECRET)), "the webhook secret is not logged");
    console.log = write;
    console.info = info;
    console.warn = warn;
    console.error = error;
    console.log("supplier webhook checks ok");
  } catch (caught) {
    console.log = write;
    console.info = info;
    console.warn = warn;
    console.error = error;
    throw caught;
  }
}

void main();
