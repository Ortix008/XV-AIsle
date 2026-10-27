import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProductBuy } from "../src/components/product-buy";
import { ShopCardCopy } from "../src/components/shop-grid";
import { SOLD_OUT_LABEL } from "../src/lib/sold-out-label";
import type { StockSql } from "../src/lib/stock-caps";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-stock-")), "stock.sqlite");
process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
delete process.env.STRIPE_SECRET_KEY;
delete process.env.DEMO_SEED;

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

const pageListing = {
  productId: "limited-pan",
  sku: "LIM-1",
  title: "Limited pan",
  description: "A pan.",
  priceCents: 2695,
  image: "",
  supplierName: "Example Seller",
};

async function main() {
  const {
    HOLD_MS,
    capMatches,
    checkoutExpiresAt,
    decideQuantity,
    hideMatches,
    isSoldOut,
    nextStock,
    rollbackStockCaps,
    runStockCaps,
    shopperStockError,
    unitsLeft,
  } = await import("../src/lib/stock-caps");
  const source = readFileSync(join(process.cwd(), "src/lib/stock-caps.ts"), "utf8");
  assert(!source.includes("reseller_waitlist"), "the cap script does not name the waitlist");
  assert(!source.includes("UPDATE orders") && !source.includes("INSERT INTO orders") && !source.includes("DELETE FROM orders"), "the cap script does not write orders");
  assert(HOLD_MS === 30 * 60 * 1000, "the stock hold matches a 30 minute checkout");
  assert(checkoutExpiresAt(1_000) === 1_801, "checkout expires 30 minutes from the given time");
  assert(shopperStockError({ ok: false, reason: "sold_out" }) === SOLD_OUT_LABEL, "an empty shelf says Sold out");
  assert(SOLD_OUT_LABEL === "Sold out", "the shopper label is exactly Sold out");
  assert(hideMatches("20-pearl-gs") && hideMatches("20-GARNET-GS"), "hide matching ignores case");
  assert(capMatches({ sku: "DAC7237CHF", cap: 999 }, { sku: "dac7237chf" }), "a cap matches the sku");
  assert(!capMatches({ sku: "DAC7237CHF", cap: 999 }, { sku: "other" }), "a cap does not match a different sku");
  assert(
    capMatches({ sku: "Dark Blue 2XS", cap: 30 }, { sku: "Dark Blue 2XS" }) &&
      !capMatches({ sku: "Dark Blue XS", cap: 42 }, { sku: "Dark Blue 2XS" }),
    "size skus do not swallow each other",
  );
  const firstCap = nextStock({ cap: null, onHand: null }, 30);
  assert(firstCap.changed && firstCap.cap === 30 && firstCap.onHand === 30, "the first cap fills on-hand");
  const kept = nextStock({ cap: 30, onHand: 28 }, 30);
  assert(!kept.changed && kept.onHand === 28, "running the cap again keeps units already sold");
  const raised = nextStock({ cap: 30, onHand: 28 }, 40);
  assert(raised.changed && raised.onHand === 38 && raised.cap === 40, "a higher cap adds only the difference");
  const over = decideQuantity(3, 2);
  assert(over.ok && over.qty === 2, "a quantity above remaining stock is clamped");
  assert(shopperStockError(over) === null, "clamped stock does not say Sold out");
  const none = decideQuantity(1, 0);
  assert(!none.ok && none.reason === "sold_out", "zero remaining is sold out");
  assert(decideQuantity(1, null).ok === true, "an uncapped product can still be ordered");
  const tooHigh = decideQuantity(6, 10);
  assert(!tooHigh.ok && tooHigh.reason === "qty", "checkout still stops at five");
  const hiddenQty = decideQuantity(1, 4, true);
  assert(!hiddenQty.ok && hiddenQty.reason === "hidden", "a hidden product cannot be added");
  assert(unitsLeft(5, 2) === 3, "open holds reduce what a shopper can take");
  assert(isSoldOut(1, 1) && !isSoldOut(null, 9), "sold out is a tracked empty shelf");

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { createPendingOrder, fulfillPaidOrder, getListing, listPublished, publishListing } = await import("../src/lib/server/store");
  const { commitPaidStock, releaseHeldStock } = await import("../src/lib/server/inventory");
  const { POST } = await import("../src/app/api/store/cart/route");
  const db = getDb() as unknown as StockSql;
  const empty = runStockCaps(db, false);
  assert(!empty.ok && empty.lines.includes("aborted"), "a missing sku aborts");
  assert(!empty.lines.includes("dry-run"), "an abort is not a dry-run");
  assert(empty.lines.includes("20-PEARL-GS not_found") && empty.lines.includes("DAC7237CHF not_found"), "missing skus are logged");
  assert(empty.lines.includes("Dark Blue 2XS not_found") && empty.lines.includes("Green XS not_found"), "missing variant skus are logged");
  const emptyApply = runStockCaps(db, true);
  assert(!emptyApply.ok && emptyApply.lines.join("\n") === empty.lines.join("\n"), "apply writes nothing when a sku is missing");

  const joined = signUp({ name: "Stock Seller", email: "stock-seller@example.com", password: "stock-test-password" });
  if ("error" in joined) throw new Error(joined.error);
  const sellerId = joined.account.id;
  function list(productId: string, sku: string, title: string) {
    const saved = publishListing(sellerId, {
      productId,
      sku,
      title,
      description: "A checked piece.",
      priceCents: 2695,
      image: "",
      supplierName: "Example Seller",
      supplierOrigin: "Elizabeth, NJ",
      shipDaysMin: 2,
      shipDaysMax: 4,
      supplierAccountId: sellerId,
      supplierCostCents: 500,
      supplierUsConfirmed: true,
      shipsFrom: "Elizabeth, NJ",
    });
    if ("error" in saved) throw new Error(saved.error);
  }
  list("pearl", "20-PEARL-GS", "Pearl");
  list("garnet", "20-GARNET-GS", "Garnet");
  list("flag", "DAC7237CHF", "Flag");
  list("shirt", "TEE-1", "Night shirt");
  list("green-xs", "Green XS", "Green shirt");
  list("limited", "LIM-1", "Limited pan");
  list("decoy", "DECOY-1", "Dark Blue 2XS");
  const variant = getDb().prepare(
    `INSERT INTO listing_variants (id, product_id, sku, label, hidden) VALUES (?, 'shirt', ?, ?, 0)`,
  );
  variant.run("var-db-2xs", "Dark Blue 2XS", "2XS");
  variant.run("var-db-xs", "Dark Blue XS", "XS");
  variant.run("var-gn-2xs", "Green 2XS", "2XS");
  getDb()
    .prepare(
      `INSERT INTO listing_variants (id, product_id, sku, label, hidden) VALUES ('var-decoy', 'green-xs', 'OTHER-SIZE', 'Dark Blue 2XS', 0)`,
    )
    .run();
  getDb()
    .prepare(
      `INSERT INTO listing_variants (id, product_id, sku, label, hidden) VALUES ('var-dup', 'green-xs', 'Dark Blue XS', 'other', 0)`,
    )
    .run();
  const ambiguous = runStockCaps(db, true);
  assert(!ambiguous.ok && ambiguous.lines.includes("Dark Blue XS ambiguous") && ambiguous.lines.includes("aborted"), "two rows for one sku abort");
  const untouched = getDb().prepare("SELECT stock_cap AS cap FROM listing_variants WHERE id = 'var-db-xs'").get() as {
    cap: number | null;
  };
  assert(untouched.cap == null, "an ambiguous sku is not capped");
  getDb().prepare("DELETE FROM listing_variants WHERE id = 'var-dup'").run();
  getDb()
    .prepare(
      `INSERT INTO orders (
         id, number, product_id, account_id, customer_name, email, qty, amount_cents,
         ship_line1, ship_city, ship_region, ship_postal, ship_country, status, created_at
       ) VALUES ('ord-keep', 'XV-9001', 'flag', ?, 'Buyer', 'buyer@example.com', 1, 2695,
         '100 Example Street', 'Sample City', 'ST', '00000', 'US', 'paid', 1)`,
    )
    .run(sellerId);
  getDb().prepare("INSERT INTO reseller_waitlist (email, created_at) VALUES ('wait@example.com', 1)").run();
  getDb()
    .prepare(
      `INSERT INTO stock_holds (order_id, product_id, variant_id, qty, state, created_at)
       VALUES ('ord-keep', 'flag', NULL, 1, 'committed', 1)`,
    )
    .run();
  const ordersBefore = JSON.stringify(getDb().prepare("SELECT * FROM orders").all());
  const waitBefore = JSON.stringify(getDb().prepare("SELECT * FROM reseller_waitlist").all());
  const holdsBefore = JSON.stringify(getDb().prepare("SELECT * FROM stock_holds").all());

  const planned = runStockCaps(db, false);
  assert(planned.ok && planned.lines[0] === "dry-run", "the default run prints a plan");
  assert(planned.lines.includes("20-PEARL-GS hidden") && planned.lines.includes("Dark Blue 2XS cap 30 on_hand 30"), "the plan names each sku");
  const plannedPearl = getDb().prepare("SELECT hidden_from_shop AS hidden FROM listings WHERE product_id = 'pearl'").get() as {
    hidden: number;
  };
  const plannedFlag = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'flag'").get() as {
    on_hand: number | null;
  };
  assert(plannedPearl.hidden === 0 && plannedFlag.on_hand == null, "a dry-run does not write stock");
  const appliedRun = runStockCaps(db, true);
  assert(appliedRun.ok && !appliedRun.lines.includes("dry-run"), "apply writes after a clean plan");
  const applied = appliedRun.lines;
  assert(applied.filter((line) => line === "20-PEARL-GS hidden").length === 1, "pearl is hidden once");
  assert(applied.filter((line) => line === "20-GARNET-GS hidden").length === 1, "garnet is hidden once");
  assert(!applied.some((line) => line.endsWith(" unchanged")), "the first run does not also call a hide unchanged");
  assert(applied.includes("DAC7237CHF cap 999 on_hand 999"), "the flag cap is logged by sku");
  assert(applied.includes("Dark Blue 2XS cap 30 on_hand 30"), "dark blue 2xs is capped by sku");
  assert(applied.includes("Dark Blue XS cap 42 on_hand 42"), "dark blue xs is capped by sku");
  assert(applied.includes("Green 2XS cap 25 on_hand 25"), "green 2xs is capped by sku");
  assert(applied.includes("Green XS cap 161 on_hand 161"), "green xs is capped by sku");
  const decoyListing = getDb().prepare("SELECT stock_cap AS cap FROM listings WHERE product_id = 'decoy'").get() as {
    cap: number | null;
  };
  const decoyVariant = getDb().prepare("SELECT stock_cap AS cap FROM listing_variants WHERE id = 'var-decoy'").get() as {
    cap: number | null;
  };
  assert(decoyListing.cap == null && decoyVariant.cap == null, "a size label on another sku is not capped");
  const againRun = runStockCaps(db, true);
  const again = againRun.lines;
  assert(again.includes("20-PEARL-GS unchanged") && again.includes("20-GARNET-GS unchanged"), "hiding twice stays hidden");
  assert(again.includes("DAC7237CHF unchanged cap 999 on_hand 999"), "the flag cap does not change on a second run");
  assert(again.includes("Dark Blue 2XS unchanged cap 30 on_hand 30"), "a variant cap does not change on a second run");
  assert(again.includes("Green XS unchanged cap 161 on_hand 161"), "a second run keeps the green sku");
  assert(!again.some((line) => line.endsWith(" hidden")), "the second run does not hide again");
  assert(JSON.stringify(getDb().prepare("SELECT * FROM orders").all()) === ordersBefore, "the script leaves orders alone");
  assert(JSON.stringify(getDb().prepare("SELECT * FROM reseller_waitlist").all()) === waitBefore, "the script leaves the waitlist alone");
  assert(JSON.stringify(getDb().prepare("SELECT * FROM stock_holds").all()) === holdsBefore, "the script leaves stock holds alone");
  assert(!listPublished().some((item) => item.productId === "pearl" || item.productId === "garnet"), "hidden skus leave the shop");
  const pearl = createPendingOrder({ productId: "pearl", qty: 1, ship });
  assert("error" in pearl && pearl.error === "That page is not on the store.", "a hidden sku cannot be bought");
  const pearlCart = await POST(
    new Request("http://127.0.0.1/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "pearl", qty: 1 }),
    }),
  );
  const pearlCartBody = (await pearlCart.json()) as { error?: string };
  assert(pearlCart.status === 400 && pearlCartBody.error === "That page is not on the store.", "a hidden sku cannot be added to the cart");

  getDb().prepare("UPDATE listings SET stock_cap = 2, stock_on_hand = 2 WHERE product_id = 'limited'").run();
  const cart = await POST(
    new Request("http://127.0.0.1/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: "limited", qty: 3 }),
    }),
  );
  const cartBody = (await cart.json()) as { error?: string; qty?: number };
  assert(cart.status === 200 && cartBody.qty === 2 && cartBody.error == null, "the cart clamps to remaining stock");
  const heldOrder = createPendingOrder({ productId: "limited", qty: 3, ship });
  assert(!("error" in heldOrder) && heldOrder.order.qty === 2 && heldOrder.order.amountCents === 5390, "checkout clamps to remaining stock");
  if ("error" in heldOrder) throw new Error(heldOrder.error);
  const during = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'limited'").get() as {
    on_hand: number;
  };
  assert(during.on_hand === 2, "pending checkout does not decrement stock");
  const blocked = createPendingOrder({ productId: "limited", qty: 1, ship });
  assert("error" in blocked && blocked.error === SOLD_OUT_LABEL, "a hold blocks the last units");
  commitPaidStock(heldOrder.order.id);
  const paid = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'limited'").get() as {
    on_hand: number;
  };
  assert(paid.on_hand === 0, "a paid order decrements stock");
  commitPaidStock(heldOrder.order.id);
  const replay = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'limited'").get() as {
    on_hand: number;
  };
  assert(replay.on_hand === 0, "paying the same order twice does not decrement again");
  const gone = createPendingOrder({ productId: "limited", qty: 1, ship });
  assert("error" in gone && gone.error === SOLD_OUT_LABEL, "zero stock cannot be bought");

  const choose = createPendingOrder({ productId: "shirt", qty: 1, ship });
  assert("error" in choose && choose.error === "Choose a product.", "a shirt with variants needs a variant");
  getDb().prepare("UPDATE listing_variants SET stock_on_hand = 1 WHERE id = 'var-db-2xs'").run();
  const variantOrder = createPendingOrder({ productId: "shirt", variantId: "var-db-2xs", qty: 2, ship });
  if ("error" in variantOrder || !variantOrder.order) throw new Error("variant clamp");
  assert(variantOrder.order.qty === 1, "a variant clamps to its remaining stock");
  commitPaidStock(variantOrder.order.id);
  const variantLeft = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listing_variants WHERE id = 'var-db-2xs'").get() as {
    on_hand: number;
  };
  const parentLeft = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'shirt'").get() as {
    on_hand: number | null;
  };
  assert(variantLeft.on_hand === 0 && parentLeft.on_hand == null, "variant stock drops on the variant row");

  const flagOrder = createPendingOrder({ productId: "flag", qty: 1, ship });
  if ("error" in flagOrder) throw new Error(flagOrder.error);
  commitPaidStock(flagOrder.order.id);
  const flagAfterSale = runStockCaps(db, true).lines;
  assert(flagAfterSale.includes("DAC7237CHF unchanged cap 999 on_hand 998"), "a later run does not restock the flag");
  const flagRow = getDb().prepare("SELECT stock_cap AS cap, stock_on_hand AS on_hand FROM listings WHERE product_id = 'flag'").get() as {
    cap: number;
    on_hand: number;
  };
  assert(flagRow.cap === 999 && flagRow.on_hand === 998, "flag stock stays at the sold count");
  const republished = publishListing(sellerId, {
    productId: "flag",
    sku: "DAC7237CHF",
    title: "Flag",
    description: "A checked piece.",
    priceCents: 2695,
    image: "",
    supplierName: "Example Seller",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: sellerId,
    supplierCostCents: 500,
  });
  if ("error" in republished || !republished.listing) throw new Error("republish");
  assert(republished.listing.stockCap === 999 && republished.listing.stockOnHand === 998, "republish keeps the cap");

  const rolled = rollbackStockCaps(db);
  assert(rolled.includes("DAC7237CHF restore_skipped"), "a sold cap is not rewound by the reverse script");
  assert(rolled.includes("20-PEARL-GS restored") && rolled.includes("20-GARNET-GS restored"), "unsold hides are restored");
  assert(getListing("pearl")?.hiddenFromShop === false, "pearl is visible again");
  assert(flagRow.cap === 999, "the skipped flag cap is still the launch cap");
  const flagStill = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'flag'").get() as {
    on_hand: number;
  };
  assert(flagStill.on_hand === 998, "the reverse script does not put sold units back");
  const rolledAgain = rollbackStockCaps(db);
  assert(rolledAgain.includes("DAC7237CHF restore_skipped"), "a second reverse leaves the sold sku skipped");
  assert(!rolledAgain.includes("20-PEARL-GS restored"), "a restored sku is not restored twice");
  assert(getListing("pearl")?.hiddenFromShop === false, "pearl stays visible after the second reverse");
  assert(JSON.stringify(getDb().prepare("SELECT * FROM orders WHERE id = 'ord-keep'").all()) === JSON.stringify(JSON.parse(ordersBefore)), "rollback does not rewrite the old order");
  assert(JSON.stringify(getDb().prepare("SELECT * FROM reseller_waitlist").all()) === waitBefore, "rollback does not rewrite the waitlist");

  const soldMarkup = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: pageListing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/limited",
      stock: { unitsLeft: 0, variants: [] },
    }),
  );
  assert(soldMarkup.includes(SOLD_OUT_LABEL), "a zero-stock page says Sold out");
  assert(soldMarkup.includes("disabled") && soldMarkup.includes('type="button"'), "sold out cannot be submitted");
  assert(!soldMarkup.includes("Continue to checkout"), "sold out has no add-to-cart button");
  const openMarkup = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: pageListing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/limited",
      stock: { unitsLeft: 2, variants: [] },
    }),
  );
  assert(openMarkup.includes("Continue to checkout") && openMarkup.includes('max="2"'), "remaining stock caps the quantity field");
  assert(!openMarkup.includes(SOLD_OUT_LABEL), "available stock does not say Sold out");
  const card = renderToStaticMarkup(
    createElement(ShopCardCopy, {
      listing: { productId: "limited", title: "Limited pan", priceCents: 2695, image: "", soldOut: true },
    }),
  );
  assert(card.includes(SOLD_OUT_LABEL), "a sold-out card says Sold out");
  const stockedCard = renderToStaticMarkup(
    createElement(ShopCardCopy, {
      listing: { productId: "limited", title: "Limited pan", priceCents: 2695, image: "" },
    }),
  );
  assert(!stockedCard.includes(SOLD_OUT_LABEL), "an in-stock card does not say Sold out");
  const sizeMarkup = renderToStaticMarkup(
    createElement(ProductBuy, {
      listing: pageListing,
      returnNote: "We'll email the return address when you start a return.",
      shareHref: "http://127.0.0.1/shop/limited",
      stock: {
        unitsLeft: 1,
        variants: [
          { id: "clay", label: "Clay", unitsLeft: 0, soldOut: true },
          { id: "night", label: "Night", unitsLeft: 1, soldOut: false },
        ],
      },
    }),
  );
  assert(sizeMarkup.includes("Clay (Sold out)") && sizeMarkup.includes("disabled"), "a sold-out size is disabled and uses Sold out");
  assert(sizeMarkup.includes(">Night<") && sizeMarkup.includes("Continue to checkout"), "an available size stays selectable");

  const flagBeforeLate = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'flag'").get() as {
    on_hand: number;
  };
  const paidLate = createPendingOrder({ productId: "flag", qty: 1, ship });
  if ("error" in paidLate) throw new Error(paidLate.error);
  getDb().prepare("UPDATE stock_holds SET state = 'released' WHERE order_id = ?").run(paidLate.order.id);
  assert(commitPaidStock(paidLate.order.id) === "committed", "a payment after the hold expired still decrements");
  const flagLate = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'flag'").get() as {
    on_hand: number;
  };
  const lateFlag = getDb().prepare("SELECT fulfillment_flag FROM orders WHERE id = ?").get(paidLate.order.id) as {
    fulfillment_flag: string | null;
  };
  assert(flagLate.on_hand === flagBeforeLate.on_hand - 1 && lateFlag.fulfillment_flag == null, "a covered late payment is not flagged");

  getDb()
    .prepare("UPDATE listings SET route = 'email', supplier_email = 'brand@example.com', stock_on_hand = 1 WHERE product_id = 'limited'")
    .run();
  const shortOrder = createPendingOrder({ productId: "limited", qty: 1, ship });
  if ("error" in shortOrder) throw new Error(shortOrder.error);
  getDb().prepare("UPDATE stock_holds SET state = 'released' WHERE order_id = ?").run(shortOrder.order.id);
  getDb().prepare("UPDATE listings SET stock_on_hand = 0 WHERE product_id = 'limited'").run();
  assert(commitPaidStock(shortOrder.order.id) === "short", "a late payment that would go below zero is short");
  const shortStock = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'limited'").get() as {
    on_hand: number;
  };
  const shortHold = getDb().prepare("SELECT state FROM stock_holds WHERE order_id = ?").get(shortOrder.order.id) as { state: string };
  const shortRow = getDb().prepare("SELECT fulfillment_flag FROM orders WHERE id = ?").get(shortOrder.order.id) as {
    fulfillment_flag: string | null;
  };
  assert(shortStock.on_hand === 0 && shortHold.state === "short" && shortRow.fulfillment_flag === "review", "short stock is flagged and not subtracted");
  assert(commitPaidStock(shortOrder.order.id) === "short", "a short payment does not subtract on replay");
  const stillShort = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'limited'").get() as {
    on_hand: number;
  };
  assert(stillShort.on_hand === 0, "replay leaves the shelf at zero");
  getDb().prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(Date.now(), shortOrder.order.id);
  const reviewed = await fulfillPaidOrder(shortOrder.order.id);
  if (!reviewed) throw new Error("a short payment waits for manual review");
  assert(reviewed.status === "needs_placing" && reviewed.fulfillmentFlag === "review", "a short payment waits for manual review");
  assert(reviewed.status !== "sent_to_supplier", "a short payment is not sent to the supplier");
  getDb().prepare("UPDATE listings SET stock_on_hand = 1 WHERE product_id = 'limited'").run();
  assert(commitPaidStock(shortOrder.order.id) === "committed", "stock that arrives later can still cover the paid order");
  const covered = getDb().prepare("SELECT stock_on_hand AS on_hand FROM listings WHERE product_id = 'limited'").get() as {
    on_hand: number;
  };
  const cleared = getDb().prepare("SELECT fulfillment_flag FROM orders WHERE id = ?").get(shortOrder.order.id) as {
    fulfillment_flag: string | null;
  };
  assert(covered.on_hand === 0 && cleared.fulfillment_flag == null, "covering the shortfall clears the review flag");

  getDb().prepare("UPDATE listings SET stock_on_hand = 1 WHERE product_id = 'limited'").run();
  const aging = createPendingOrder({ productId: "limited", qty: 1, ship });
  if ("error" in aging) throw new Error(aging.error);
  const reserved = createPendingOrder({ productId: "limited", qty: 1, ship });
  assert("error" in reserved && reserved.error === SOLD_OUT_LABEL, "a fresh hold still reserves the last unit");
  getDb().prepare("UPDATE stock_holds SET created_at = ? WHERE order_id = ?").run(Date.now() - HOLD_MS - 1000, aging.order.id);
  const released = createPendingOrder({ productId: "limited", qty: 1, ship });
  if ("error" in released || !released.order) throw new Error("a hold older than 30 minutes is released");
  assert(releaseHeldStock(released.order.id, "other") === false, "cancel on another product does not release the hold");
  assert(releaseHeldStock(released.order.id, "limited") === true, "cancel releases the matching hold");
  const canceled = getDb().prepare("SELECT state FROM stock_holds WHERE order_id = ?").get(released.order.id) as { state: string };
  assert(canceled.state === "released", "the canceled hold is released");

  const { STOCK_REVIEW_NOTE } = await import("../src/lib/order-flags");
  const ordersView = readFileSync(join(process.cwd(), "src/components/orders-view.tsx"), "utf8");
  assert(ordersView.includes("stockReviewNote") && ordersView.includes(STOCK_REVIEW_NOTE) === false, "the admin list uses the review note helper");
  assert(
    STOCK_REVIEW_NOTE ===
      "Review this order before it ships. Payment came in after the stock hold, and the shelf could not cover it.",
    "the admin review note is the approved sentence",
  );

  const { createCheckoutSession, setStripeFetch } = await import("../src/lib/server/stripe");
  process.env.STRIPE_SECRET_KEY = `${["sk", "test"].join("_")}_example`;
  let expires = "";
  setStripeFetch(async (_url, init) => {
    const raw = init?.body;
    const body = raw instanceof URLSearchParams ? raw : new URLSearchParams(typeof raw === "string" ? raw : "");
    expires = body.get("expires_at") ?? "";
    return new Response(JSON.stringify({ id: "cs_test", url: "https://checkout.stripe.com/c/pay/cs_test" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  const before = Math.floor(Date.now() / 1000);
  await createCheckoutSession({
    kind: "order",
    accountId: "acct",
    orderId: "ord_hold",
    name: "Pan",
    amountCents: 1000,
    successPath: "/shop/return",
    cancelPath: "/shop/pan?canceled=ord_hold",
  });
  const after = Math.floor(Date.now() / 1000);
  const stamp = Number(expires);
  assert(stamp >= before + 30 * 60 && stamp <= after + 30 * 60, "the checkout session expires in 30 minutes");
  setStripeFetch(null);
  delete process.env.STRIPE_SECRET_KEY;
  const events = readFileSync(join(process.cwd(), "src/lib/server/stripe-events.ts"), "utf8");
  assert(events.includes("checkout.session.expired") && events.includes("releaseHeldStock"), "an expired checkout releases the hold");

  closeDb();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "stock check failed");
  process.exit(1);
});
