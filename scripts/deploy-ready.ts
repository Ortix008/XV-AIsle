import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function line(ok: boolean, label: string) {
  console.log(`${ok ? "ready" : "open "}  ${label}`);
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const { preferCardCheckout } = await import("../src/lib/server/card-checkout");
  const { isLiveKey } = await import("../src/lib/server/stripe");
  const { ensureStarterShelf } = await import("../src/lib/server/starter-shelf");
  const { readReturnsAddress } = await import("../src/lib/server/settings");
  const { closeDb, getDb } = await import("../src/lib/server/db");
  ensureStarterShelf();
  const shelf = getDb().prepare("SELECT product_id, title FROM listings WHERE published = 1 ORDER BY title").all() as {
    product_id: string;
    title: string;
  }[];

  const appUrl = process.env.APP_URL?.trim() ?? "";
  const stripe = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
  const supplierUrl = process.env.SUPPLIER_API_URL?.trim() ?? "";
  const supplierKey = process.env.SUPPLIER_API_KEY?.trim() ?? "";
  const database = process.env.DATABASE_PATH?.trim() || "data/xvaisle.sqlite";
  const returns = readReturnsAddress();
  const mode = !stripe ? "missing" : isLiveKey(stripe) ? "live" : "test";
  const liveAllowed = process.env.STRIPE_ALLOW_LIVE === "1";

  console.log("XVAIsle deploy checklist");
  line(appUrl.startsWith("https://xvaisle.com"), `APP_URL is ${appUrl || "unset"}. Public address is https://xvaisle.com`);
  line(
    mode === "test" || (mode === "live" && liveAllowed),
    `Stripe key is ${mode}. Test keys are the default. A live key also needs STRIPE_ALLOW_LIVE=1`,
  );
  line(Boolean(webhook), webhook ? "STRIPE_WEBHOOK_SECRET is set" : "STRIPE_WEBHOOK_SECRET is empty. Add the signing secret from /api/billing/webhook");
  line(
    Boolean(process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim()),
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET?.trim()
      ? "STRIPE_CONNECT_WEBHOOK_SECRET is set"
      : "STRIPE_CONNECT_WEBHOOK_SECRET is empty. Add the signing secret from /api/connect/webhook",
  );
  line(Boolean(process.env.ADMIN_EMAIL?.trim()), process.env.ADMIN_EMAIL?.trim() ? "ADMIN_EMAIL is set" : "ADMIN_EMAIL is empty");
  line(
    Boolean(process.env.STORE_OPERATOR_EMAIL?.trim()),
    process.env.STORE_OPERATOR_EMAIL?.trim()
      ? "STORE_OPERATOR_EMAIL is set"
      : "STORE_OPERATOR_EMAIL is empty. Starter pages stay unpublished",
  );
  line(
    Boolean(process.env.SUPPLIER_CALLBACK_SECRET?.trim()),
    process.env.SUPPLIER_CALLBACK_SECRET?.trim()
      ? "SUPPLIER_CALLBACK_SECRET is set"
      : "SUPPLIER_CALLBACK_SECRET is empty. Only an admin can mark delivery",
  );
  line(process.env.STRIPE_ALLOW_LIVE !== "1", "STRIPE_ALLOW_LIVE is off, so live keys are refused");
  line(Boolean(supplierUrl && supplierKey), supplierUrl && supplierKey ? "Supplier URL and key are both set" : "Supplier URL and key are empty. Paid orders stay queued");
  line(Boolean(returns), returns ? "Return address is saved" : "Return address is empty. Save it on /shop/safety");
  line(shelf.some((item) => item.product_id === "bench-scraper") && shelf.some((item) => item.product_id === "sheet-pan"), `Store pages: ${shelf.map((item) => item.title).join(", ") || "none yet"}`);
  line(database.startsWith("/") || database.startsWith("/data"), `Database path is ${database}. Use a disk path such as /data/xvaisle.sqlite`);
  if (process.env.TRUST_PROXY === "1") line(true, "TRUST_PROXY=1, so sign-in limits use the last forwarding hop");
  else line(true, "TRUST_PROXY is unset. Leave it unset until a reverse proxy appends the visitor address");

  if (process.env.STRIPE_CARD_CHECKOUT_ONLY === "1" && stripe) {
    const card = await preferCardCheckout();
    line(card.ok, card.ok ? "Link and US bank display are off on this Stripe key" : card.reason);
  } else {
    line(true, "STRIPE_CARD_CHECKOUT_ONLY is unset, so boot does not change Stripe payment methods");
  }

  closeDb();
}

main();
