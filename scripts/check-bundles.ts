import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-bundle-")), "bundle.sqlite");
process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
delete process.env.SMTP_HOST;
delete process.env.MAIL_FROM;
process.env.ORDER_ALERT_EMAIL = "ops@example.com";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const ship = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};

async function main() {
  const { aisleBySlug, placeProduct } = await import("../src/lib/aisles");
  const { getProduct } = await import("../src/lib/catalog");
  const { startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { createPendingOrder, fulfillPaidOrder, getListing, listPublished, publicShopListing, publishBundle, publishListing } =
    await import("../src/lib/server/store");
  const { getDb } = await import("../src/lib/server/db");

  assert(aisleBySlug("build-your-rig")?.title === "Build Your Rig", "Build Your Rig is an aisle");
  assert(aisleBySlug("tech-and-desk")?.title === "Tech & Desk", "Tech & Desk is an aisle");
  assert(aisleBySlug("home-and-gifts")?.title === "Home & Gifts", "Home & Gifts is an aisle");
  assert(placeProduct(getProduct("headphones"))?.aisle === "Build Your Rig", "headphones sit in Build Your Rig");
  assert(placeProduct(getProduct("desk-lamp"))?.aisle === "Tech & Desk", "the desk lamp sits in Tech & Desk");
  assert(placeProduct(getProduct("gift-bags"))?.aisle === "Home & Gifts", "gift bags sit in Home & Gifts");

  const page = {
    sku: "BD-1",
    description: "A piece in the bundle.",
    priceCents: 2000,
    image: "/art/mock-sheet-pan-1.png",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: null as string | null,
  };

  function piece(productId: string, title: string, supplierName: string, supplierAccountId: string | null = null) {
    const result = publishListing("acct-bundle", {
      ...page,
      productId,
      title,
      supplierName,
      supplierAccountId,
    });
    if ("error" in result || !result.listing) throw new Error("error" in result ? result.error : "piece");
    return result.listing;
  }

  piece("pan-a", "Quarter pan", "North Mill");
  piece("pan-b", "Wire rack", "North Mill");
  piece("other-pan", "Other pan", "South Mill");
  const rig = piece("headphones", "Over-ear headphones", "North Mill");
  assert(rig.aisle === "build-your-rig", "a known product lands in its aisle");

  const reseller = publishBundle(
    { id: "acct-bundle", role: "reseller" },
    {
      productId: "desk-set",
      sku: "BD-SET",
      title: "Desk set",
      description: "The pan and the rack.",
      priceCents: 4500,
      image: "",
      itemIds: ["pan-a", "pan-b"],
    },
  );
  assert("error" in reseller, "a reseller cannot price a bundle");

  const mixed = publishBundle(
    { id: "acct-bundle", role: "admin" },
    {
      productId: "mixed-set",
      sku: "BD-MIX",
      title: "Mixed set",
      description: "Two suppliers.",
      priceCents: 4500,
      image: "",
      itemIds: ["pan-a", "other-pan"],
    },
  );
  assert("error" in mixed && typeof mixed.error === "string" && mixed.error.includes("one supplier"), "two suppliers are refused");

  piece("acct-pan", "Account pan", "North Mill", "sup-1");
  const mixedKey = publishBundle(
    { id: "acct-bundle", role: "admin" },
    {
      productId: "mixed-key",
      sku: "BD-KEY",
      title: "Mixed key",
      description: "One named supplier and one account.",
      priceCents: 4500,
      image: "",
      itemIds: ["pan-a", "acct-pan"],
    },
  );
  assert("error" in mixedKey, "a name and an account are not the same supplier");

  const savings = publishBundle(
    { id: "acct-bundle", role: "admin" },
    {
      productId: "save-set",
      sku: "BD-SAVE",
      title: "Save set",
      description: "You save $10.",
      priceCents: 4500,
      image: "",
      itemIds: ["pan-a", "pan-b"],
    },
  );
  assert("error" in savings, "a savings claim is refused");

  const bundled = publishBundle(
    { id: "acct-bundle", role: "admin" },
    {
      productId: "desk-set",
      sku: "BD-SET",
      title: "Desk set",
      description: "The pan and the rack, at one price.",
      priceCents: 4500,
      image: "",
      itemIds: ["pan-a", "pan-b"],
      aisle: "tech-and-desk",
    },
  );
  if ("error" in bundled || !bundled.listing) throw new Error("error" in bundled ? bundled.error : "bundle");
  assert(bundled.listing.kind === "bundle", "the listing is a bundle");
  assert(bundled.listing.priceCents === 4500, "the admin price is the only price");
  const shown = publicShopListing(getListing("desk-set")!, false);
  assert(shown.kind === "bundle", "the public page says it is a bundle");
  assert(shown.includes?.map((item) => item.title).join(",") === "Quarter pan,Wire rack", "the public page lists the pieces");
  assert(!("compareAtPrice" in shown), "the public page has no compare-at price");
  assert(listPublished({ aisle: "tech-and-desk" }).some((item) => item.productId === "desk-set"), "the aisle filter finds the bundle");
  const bundlesOnly = listPublished({ aisle: "bundles" });
  assert(bundlesOnly.every((item) => item.kind === "bundle"), "the bundles stall lists only bundles");
  assert(bundlesOnly.some((item) => item.productId === "desk-set"), "the bundles stall includes the desk set");
  assert(!bundlesOnly.some((item) => item.productId === "pan-a"), "the bundles stall leaves single listings out");

  piece("acct-pan-b", "Account rack", "Another name", "sup-1");
  const sameAccount = publishBundle(
    { id: "acct-bundle", role: "admin" },
    {
      productId: "account-set",
      sku: "BD-ACCT",
      title: "Account set",
      description: "Same supplier account.",
      priceCents: 5000,
      image: "",
      itemIds: ["acct-pan", "acct-pan-b"],
    },
  );
  assert(!("error" in sameAccount), "one supplier account can be bundled");

  const pending = createPendingOrder({ productId: "account-set", qty: 1, ship });
  if ("error" in pending) throw new Error(pending.error);
  getDb().prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(Date.now(), pending.order.id);
  startMailCapture();
  const routed = await fulfillPaidOrder(pending.order.id);
  const mail = stopMailCapture();
  assert(routed?.status === "needs_placing", "the bundle routes through the existing paid-order path");
  assert(
    mail.some((message) => message.text.includes("Account pan") && message.text.includes("Account rack")),
    "the routed notice names both pieces",
  );

  console.log("bundle checks ok");
}

main();
