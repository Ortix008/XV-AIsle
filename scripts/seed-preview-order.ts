import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PREVIEW_CHECKOUT_SESSION, SAMPLE_ORDER_NUMBER, SAMPLE_RETURN_PARTS } from "../src/lib/sample-shelf";
import { isLiveKey } from "../src/lib/server/stripe";

const SAMPLE_SUPPLIER_EMAIL = "sample-supplier@example.com";

function refuse(message: string): never {
  console.error(message);
  process.exit(1);
}

function guardPreviewSeed() {
  if (process.env.DEMO_SEED !== "1") {
    refuse("Refusing: set DEMO_SEED=1. This script only inserts a sample order.");
  }
  if (process.env.VERCEL_ENV === "production" || (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV !== "preview")) {
    refuse("Refusing: this preview seed does not run in production.");
  }
  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  if (stripeKey && isLiveKey(stripeKey)) {
    refuse("Refusing: a live Stripe key is set. This script does not call Stripe.");
  }
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.MAIL_FROM;
}

const shipTo = {
  name: "Sample Buyer",
  email: "sample-buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};

async function main() {
  guardPreviewSeed();
  const { getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { ensureStarterShelf } = await import("../src/lib/server/starter-shelf");
  const { appOrigin } = await import("../src/lib/server/stripe");
  const { createPendingOrder, issueOrderToken, orderByStripeSession } = await import("../src/lib/server/store");

  process.env.STORE_OPERATOR_EMAIL = SAMPLE_SUPPLIER_EMAIL;
  const existingAccount = getDb().prepare("SELECT id FROM accounts WHERE email = ?").get(SAMPLE_SUPPLIER_EMAIL) as
    | { id: string }
    | undefined;
  let supplierId = existingAccount?.id;
  if (!supplierId) {
    const joined = signUp({ name: "Northwharf Goods", email: SAMPLE_SUPPLIER_EMAIL, password: "sample-preview" });
    if ("error" in joined || !joined.account) {
      const message = "error" in joined ? joined.error : undefined;
      refuse(message ?? "The sample supplier account was not created.");
    }
    supplierId = joined.account.id;
  }
  getDb().prepare("UPDATE accounts SET role = 'supplier', email_verified = 1 WHERE id = ?").run(supplierId);
  getDb()
    .prepare(
      `INSERT INTO supplier_returns (supplier_key, line1, city, region, postal, country, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(supplier_key) DO UPDATE SET
         line1 = excluded.line1,
         city = excluded.city,
         region = excluded.region,
         postal = excluded.postal,
         country = excluded.country,
         updated_at = excluded.updated_at`,
    )
    .run(
      `id:${supplierId}`,
      SAMPLE_RETURN_PARTS.line1,
      SAMPLE_RETURN_PARTS.city,
      SAMPLE_RETURN_PARTS.region,
      SAMPLE_RETURN_PARTS.postal,
      SAMPLE_RETURN_PARTS.country,
      Date.now(),
    );
  ensureStarterShelf();
  getDb()
    .prepare(
      `UPDATE listings
       SET supplier_account_id = ?, supplier_cost_cents = 0, published = 1
       WHERE product_id = 'sheet-pan' AND supplier_name = 'Northwharf Goods'`,
    )
    .run(supplierId);
  const listing = getDb()
    .prepare("SELECT product_id FROM listings WHERE product_id = 'sheet-pan' AND supplier_name = 'Northwharf Goods'")
    .get();
  if (!listing) refuse("The sample sheet pan was not published. Set DEMO_SEED=1 and try again.");

  const already = orderByStripeSession(PREVIEW_CHECKOUT_SESSION);
  let orderId: string;
  let token: string;
  if (already) {
    orderId = already.id;
    token = issueOrderToken(already.id, "customer_link_hash");
  } else {
    const created = createPendingOrder({ productId: "sheet-pan", qty: 1, ship: shipTo });
    if ("error" in created) refuse(created.error ?? "The sample order was not created.");
    orderId = created.order.id;
    getDb()
      .prepare(
        `UPDATE orders
         SET status = 'paid',
             paid_at = ?,
             stripe_session_id = ?,
             supplier_detail = ?
         WHERE id = ?`,
      )
      .run(
        Date.now(),
        PREVIEW_CHECKOUT_SESSION,
        "Sample order for the confirmation page. No card was charged.",
        orderId,
      );
    token = created.receiptToken;
  }
  const holder = getDb().prepare("SELECT id FROM orders WHERE number = ?").get(SAMPLE_ORDER_NUMBER) as
    | { id: string }
    | undefined;
  if (holder && holder.id !== orderId) {
    getDb().prepare("UPDATE orders SET number = ? WHERE id = ?").run(`XV-held-${holder.id}`, holder.id);
  }
  getDb()
    .prepare(
      `UPDATE orders
       SET number = ?,
           return_line1 = ?,
           return_city = ?,
           return_region = ?,
           return_postal = ?,
           return_country = ?
       WHERE id = ?`,
    )
    .run(
      SAMPLE_ORDER_NUMBER,
      SAMPLE_RETURN_PARTS.line1,
      SAMPLE_RETURN_PARTS.city,
      SAMPLE_RETURN_PARTS.region,
      SAMPLE_RETURN_PARTS.postal,
      SAMPLE_RETURN_PARTS.country,
      orderId,
    );
  const url = `${appOrigin()}/shop/return?token=${encodeURIComponent(token)}&session_id=${encodeURIComponent(PREVIEW_CHECKOUT_SESSION)}`;
  console.log(url);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  void main();
}

export { main as seedPreviewOrder };
