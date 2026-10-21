import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-returns-")), "returns.sqlite");
delete process.env.STORE_RETURNS;
delete process.env.DEMO_SEED;
delete process.env.SMTP_HOST;
delete process.env.MAIL_FROM;
process.env.ORDER_ALERT_EMAIL = "ops@example.com";

const STREET = "200 Example Avenue";
const CITY = "Sample City";
const REGION = "ST";
const POSTAL = "00000";
const COUNTRY = "US";
const OVERRIDE = "300 Example Avenue";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const address = { line1: STREET, city: CITY, region: REGION, postal: POSTAL, country: COUNTRY };

async function main() {
  const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
  const catchAll = config.indexOf('source: "/:path*"');
  const brand = config.indexOf('source: "/brand/:path*"');
  const brandBlock = config.slice(brand, config.indexOf("source:", brand + 10));
  assert(catchAll >= 0 && brand > catchAll, "brand headers come after the site-wide headers");
  assert(config.includes('{ key: "Cross-Origin-Resource-Policy", value: "same-origin" }'), "the site CORP stays same-origin");
  assert(brandBlock.includes('{ key: "Cross-Origin-Resource-Policy", value: "cross-origin" }'), "brand images can load in an email client");
  assert(!brandBlock.includes("X-Frame-Options") && !brandBlock.includes("Content-Security-Policy"), "the brand rule only changes CORP");

  const { RETURNS_EMAILED, parseReturnAddress } = await import("../src/lib/return-address");
  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { SAMPLE_ORDER_NUMBER, SAMPLE_RETURN_PARTS } = await import("../src/lib/sample-shelf");
  const { receiptHtml, receiptText, sampleReceiptHtml } = await import("../src/lib/server/order-mail");
  const { buyerOrder, presentOrder, publicListing, resellerListing } = await import("../src/lib/server/order-view");
  const { saveReturnsAddress } = await import("../src/lib/server/settings");
  const { ensureStarterShelf, sampleProductReturnNote } = await import("../src/lib/server/starter-shelf");
  const { createPendingOrder, fulfillPaidOrder, getListing, getOrder, listPublished, publishListing } = await import(
    "../src/lib/server/store"
  );
  const { visibleOnShop } = await import("../src/lib/server/starter-shelf");
  const {
    listSupplierReturns,
    resolveReturnAddress,
    returnCopyForListing,
    saveProductReturn,
    saveSupplierReturn,
    storeReturnCopy,
  } = await import("../src/lib/server/supplier-returns");

  for (const line of ["PO Box 10", "P.O. Box 10", "p.o. box 10", "P.O.Box 10", "Post Office Box 10", "pobox 10"]) {
    const rejected = parseReturnAddress({ ...address, line1: line });
    assert("error" in rejected, `${line} should be rejected`);
  }
  assert(!("error" in parseReturnAddress(address)), "an example street is accepted");
  assert("empty" in parseReturnAddress({ line1: " ", city: "", region: "", postal: "", country: "" }), "a blank address clears");
  assert("error" in parseReturnAddress({ ...address, city: "" }), "a partial address is rejected");
  const legacy = saveReturnsAddress("PO Box 10, Sample City, ST 00000");
  assert("error" in legacy, "the old store line also rejects a PO Box");

  const columns = getDb().prepare("PRAGMA table_info(listings)").all() as { name: string }[];
  assert(columns.some((column) => column.name === "return_line1"), "listings gain a return street column");
  assert(columns.some((column) => column.name === "hidden_from_shop"), "listings can be hidden from the shop");
  assert(columns.some((column) => column.name === "supplier_us_confirmed"), "listings can record a confirmed US supplier");
  const { TRACKING_SHIP, US_SUPPLIER_SHIP, productShipLine, receiptShipWindow, unconfirmedShipLine } = await import(
    "../src/lib/order-facts"
  );
  assert(
    unconfirmedShipLine({ supplierName: "Northwharf Goods", shipsFrom: "Elizabeth, NJ", supplierUsConfirmed: true }) ===
      US_SUPPLIER_SHIP,
    "a confirmed US supplier uses the US line",
  );
  assert(
    unconfirmedShipLine({ supplierName: "XV-AIsle", shipsFrom: "Elizabeth, NJ", supplierUsConfirmed: true }) === TRACKING_SHIP,
    "the store itself is not a US supplier line",
  );
  assert(
    unconfirmedShipLine({ supplierName: "Northwharf Goods", shipsFrom: "Elizabeth, NJ", supplierUsConfirmed: false }) ===
      TRACKING_SHIP,
    "an unflagged supplier uses tracking only",
  );
  assert(
    unconfirmedShipLine({ supplierName: "Northwharf Goods", shipsFrom: "Toronto, ON", supplierUsConfirmed: true }) ===
      TRACKING_SHIP,
    "a non-US ships-from uses tracking only",
  );
  assert(
    unconfirmedShipLine({ supplierName: "Northwharf Goods", shipsFrom: "Sample City, ST", supplierUsConfirmed: true }) ===
      TRACKING_SHIP,
    "a sample region is not a US location",
  );
  assert(
    productShipLine({ supplierName: "Northwharf Goods", shipDaysMin: 2, shipDaysMax: 4 }) ===
      "Our expected window is 2–4 days after you pay.",
    "a confirmed window names the product days",
  );
  assert(receiptShipWindow(2, 2) === "Usually ships in 2 business days.", "equal days collapse to one number");
  assert(receiptShipWindow(0, 0) === TRACKING_SHIP, "a receipt without days and without a US supplier uses tracking only");
  assert(getDb().prepare("SELECT name FROM sqlite_master WHERE name = 'supplier_returns'").get(), "supplier_returns exists");

  const joined = signUp({ name: "Example Supply", email: "returns-supplier@example.com", password: "market-test" });
  if ("error" in joined || !joined.account) throw new Error("supplier");
  getDb().prepare("UPDATE accounts SET role = 'supplier', email_verified = 1 WHERE id = ?").run(joined.account.id);
  const supplierId = joined.account.id;
  const admin = {
    id: "operator",
    role: "admin" as const,
    memberSince: 1,
    membershipStatus: "active",
    emailVerified: true,
    totpEnabled: false,
  };
  const reseller = { ...admin, role: "reseller" as const };

  const denied = saveSupplierReturn(reseller, `id:${supplierId}`, address);
  assert("error" in denied && denied.status === 403, "a reseller cannot save a supplier return address");
  assert(storeReturnCopy() === RETURNS_EMAILED, "no address yet uses the emailed line");

  const saved = saveSupplierReturn(admin, `id:${supplierId}`, address);
  assert(!("error" in saved) && saved.address?.line1 === STREET, "an operator can save a supplier return address");
  assert(storeReturnCopy() === RETURNS_EMAILED, "a saved supplier address still uses the emailed line");
  const listed = listSupplierReturns().find((item) => item.key === `id:${supplierId}`);
  assert(listed?.line1 === STREET && listed.postal === POSTAL, "admin can read the supplier address back");

  const published = publishListing(supplierId, {
    productId: "return-pan",
    sku: "RTN-1",
    title: "Return pan",
    description: "A pan for the return check.",
    priceCents: 2000,
    image: "",
    supplierName: "Example Supply",
    supplierOrigin: "US",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: supplierId,
    supplierCostCents: 500,
  });
  if ("error" in published || !published.listing) throw new Error("listing");
  assert(published.listing.returnLine1 == null, "a new listing does not invent a return address");
  const resolved = resolveReturnAddress(published.listing);
  assert(resolved?.line1 === STREET, "the listing uses the supplier address");
  assert(returnCopyForListing(published.listing) === RETURNS_EMAILED, "an unconfirmed product emails the return address later");
  const publicJson = JSON.stringify(publicListing(published.listing));
  const resellerJson = JSON.stringify(resellerListing(published.listing));
  assert(!publicJson.includes(STREET) && !publicJson.includes("returnLine1"), "the public listing omits the street");
  assert(!publicJson.includes("hiddenFromShop"), "the public listing omits the hide flag");
  assert(publicJson.includes('"supplierUsConfirmed":false'), "the public listing includes the US confirmation");
  assert(!resellerJson.includes(STREET), "a reseller listing omits the street");
  const hidden = publishListing(supplierId, {
    productId: "hidden-pan",
    sku: "RTN-H",
    title: "Hidden pan",
    description: "A pan kept off the shelf.",
    priceCents: 2000,
    image: "",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipsFrom: "Elizabeth, NJ",
    shipDaysMin: 0,
    shipDaysMax: 0,
    supplierAccountId: supplierId,
    supplierCostCents: 500,
    hiddenFromShop: true,
    supplierUsConfirmed: true,
  });
  if ("error" in hidden || !hidden.listing) throw new Error("hidden listing");
  assert(hidden.listing.hiddenFromShop === true && hidden.listing.supplierUsConfirmed === true, "the shelf flags save");
  assert(!listPublished().some((item) => item.productId === "hidden-pan"), "a hidden listing stays off the public shelf");
  assert(visibleOnShop(hidden.listing) === false, "the shop gate hides a flagged listing");
  const hiddenOrder = createPendingOrder({
    productId: "hidden-pan",
    qty: 1,
    ship: { name: "Example Buyer", email: "buyer@example.com", line1: STREET, city: CITY, region: REGION, postal: POSTAL, country: COUNTRY },
  });
  assert("error" in hiddenOrder, "checkout does not sell a hidden listing");
  const kept = publishListing(supplierId, {
    productId: "hidden-pan",
    sku: "RTN-H",
    title: "Hidden pan",
    description: "A pan kept off the shelf.",
    priceCents: 2000,
    image: "",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipsFrom: "Elizabeth, NJ",
    shipDaysMin: 0,
    shipDaysMax: 0,
    supplierAccountId: supplierId,
    supplierCostCents: 500,
  });
  if ("error" in kept || !kept.listing) throw new Error("kept listing");
  assert(kept.listing.hiddenFromShop === true && kept.listing.supplierUsConfirmed === true, "republish keeps omitted shelf flags");
  assert(
    productShipLine(kept.listing) === null,
    "a confirmed US supplier with no day window omits the product window",
  );
  const hiddenPublic = JSON.stringify(publicListing(kept.listing));
  assert(!hiddenPublic.includes("hiddenFromShop"), "a hidden listing's public shape still omits the hide flag");

  saveReturnsAddress("100 Example Street, Sample City, ST 00000");
  assert(resolveReturnAddress(getListing("return-pan")!)?.line1 === STREET, "the old store line is not the supplier address");

  const poProduct = saveProductReturn(admin, "return-pan", { ...address, line1: "P.O. Box 4" });
  assert("error" in poProduct, "a product override rejects a PO Box");
  const override = saveProductReturn(admin, "return-pan", { ...address, line1: OVERRIDE });
  assert(!("error" in override) && override.address?.line1 === OVERRIDE, "a product override saves");
  assert(resolveReturnAddress(getListing("return-pan")!)?.line1 === OVERRIDE, "the product override wins");
  const cleared = saveProductReturn(admin, "return-pan", { line1: "", city: "", region: "", postal: "", country: "" });
  assert(!("error" in cleared) && cleared.address === null, "a blank override clears");
  assert(resolveReturnAddress(getListing("return-pan")!)?.line1 === STREET, "clearing the override uses the supplier address");

  const other = signUp({ name: "Quiet Supply", email: "quiet-supplier@example.com", password: "market-test" });
  if ("error" in other || !other.account) throw new Error("quiet supplier");
  getDb().prepare("UPDATE accounts SET role = 'supplier' WHERE id = ?").run(other.account.id);
  const named = publishListing(supplierId, {
    productId: "named-pan",
    sku: "RTN-2",
    title: "Named pan",
    description: "A pan with a name only.",
    priceCents: 2000,
    image: "",
    supplierName: "Name Only Supply",
    supplierOrigin: "US",
    shipDaysMin: 2,
    shipDaysMax: 4,
    supplierAccountId: other.account.id,
    supplierCostCents: 500,
  });
  if ("error" in named || !named.listing) throw new Error("named");
  assert(resolveReturnAddress(named.listing) === null, "a supplier without an address stays blank");
  assert(returnCopyForListing(named.listing) === RETURNS_EMAILED, "an unconfirmed supplier emails the return address later");
  const nameKey = listSupplierReturns().find((item) => item.label === "Name Only Supply")?.key;
  if (!nameKey) throw new Error("the listing name is a supplier choice");
  const namedSave = saveSupplierReturn(admin, nameKey, { ...address, line1: "400 Example Avenue" });
  assert(!("error" in namedSave), "an operator can save an address for a supplier name");
  assert(
    resolveReturnAddress(getListing("named-pan")!)?.line1 === "400 Example Avenue",
    "a name address applies when the supplier account has none",
  );
  getDb().prepare("DELETE FROM supplier_returns WHERE supplier_key = ?").run(nameKey);

  const pending = createPendingOrder({
    productId: "return-pan",
    qty: 1,
    ship: { name: "Example Buyer", email: "buyer@example.com", line1: "100 Example Street", city: CITY, region: REGION, postal: POSTAL, country: COUNTRY },
  });
  if ("error" in pending) throw new Error(pending.error);
  assert(pending.order.returnLine1 === STREET, "the order stores the supplier address");
  const buyerJson = JSON.stringify(buyerOrder(pending.order));
  assert(buyerJson.includes(STREET), "the buyer order includes the return street");
  const deskJson = JSON.stringify(presentOrder(admin, pending.order, pending.listing));
  assert(!deskJson.includes(STREET), "the desk order view does not add the return street");

  const { GET } = await import("../src/app/api/store/receipt/route");
  const receipt = await GET(new Request(`http://127.0.0.1/api/store/receipt?token=${pending.receiptToken}`));
  const receiptBody = (await receipt.json()) as { order?: { returnAddress?: string } };
  assert(receiptBody.order?.returnAddress === RETURNS_EMAILED, "an unconfirmed order page emails the return address later");
  assert(!receiptBody.order?.returnAddress?.includes(STREET), "an unconfirmed order page hides the supplier street");
  assert(!receiptBody.order?.returnAddress?.includes("100 Example Street"), "the order page does not swap in the ship-to street");
  getDb().prepare("UPDATE listings SET supplier_us_confirmed = 1, ships_from = ? WHERE product_id = 'return-pan'").run("Elizabeth, NJ");
  const confirmedListing = getListing("return-pan");
  assert(
    confirmedListing && returnCopyForListing(confirmedListing) === RETURNS_EMAILED,
    "a confirmed product still emails the return address",
  );
  const confirmedReceipt = await GET(new Request(`http://127.0.0.1/api/store/receipt?token=${pending.receiptToken}`));
  const confirmedBody = (await confirmedReceipt.json()) as { order?: { returnAddress?: string } };
  assert(confirmedBody.order?.returnAddress?.includes(STREET), "a confirmed order page shows the supplier street");
  getDb().prepare("UPDATE listings SET supplier_us_confirmed = 0, ships_from = NULL WHERE product_id = 'return-pan'").run();

  const blankOrder = createPendingOrder({
    productId: "named-pan",
    qty: 1,
    ship: { name: "Example Buyer", email: "buyer@example.com", line1: "100 Example Street", city: CITY, region: REGION, postal: POSTAL, country: COUNTRY },
  });
  if ("error" in blankOrder) throw new Error(blankOrder.error);
  assert(blankOrder.order.returnLine1 == null, "an order with no supplier address stores none");
  const blankReceipt = receiptText({
    number: blankOrder.order.number,
    title: "Named pan",
    qty: 1,
    shipDaysMin: 2,
    shipDaysMax: 4,
    receiptUrl: "http://127.0.0.1/shop/order?token=example",
    returnAddress: null,
  });
  assert(!blankReceipt.includes(RETURNS_EMAILED), "the receipt email omits the return line when there is no address");
  assert(!blankReceipt.includes("Need to send it back"), "a receipt without a return address omits the returns line");
  assert(blankReceipt.includes("Usually ships in 2-4 business days."), "a confirmed window names the days");
  assert(!blankReceipt.includes(STREET), "the fallback email has no street");
  assert(!blankReceipt.includes("Ships from"), "a receipt with no origin omits ships-from");
  const blankHtml = receiptHtml({
    number: blankOrder.order.number,
    title: "Named pan",
    qty: 1,
    shipsFrom: null,
    eta: null,
    shipDaysMin: 0,
    shipDaysMax: 0,
    receiptUrl: "http://127.0.0.1/shop/order?token=example",
    returnAddress: null,
  });
  assert(!blankHtml.includes(RETURNS_EMAILED) && !blankHtml.includes(">RETURNS<"), "the receipt html omits returns when there is no address");
  assert(blankHtml.includes(TRACKING_SHIP), "a receipt without ship days uses the tracking line");
  assert(!blankHtml.includes(US_SUPPLIER_SHIP), "a receipt without a confirmed US supplier omits the US line");
  assert(!blankHtml.includes(">Ships from<") && !blankHtml.includes("Arrival"), "blank receipt html omits an empty origin row");
  assert(!blankHtml.toLowerCase().includes("<script"), "the receipt html has no script");
  assert(blankHtml.includes('bgcolor="#07080a"') && blankHtml.includes("color:#f4f1ea"), "the receipt html is dark with a light-text fallback");
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  assert(blankHtml.includes(sans) && !blankHtml.includes("Georgia"), "the receipt html uses the email sans stack");
  assert(blankHtml.includes('alt="XV-AISLE"') && blankHtml.includes('width="32"'), "the receipt html includes the logo");
  assert(blankHtml.includes("/brand/logo-official-xo.png"), "the logo is the brand image");
  assert(blankHtml.includes("border-radius:999px") && blankHtml.includes("See your receipt:"), "the receipt link is a pill button");
  assert(blankHtml.includes("padding:22px 28px 0"), "the receipt button sits in the content padding");
  const sampleHtml = sampleReceiptHtml();
  assert(sampleHtml.includes("https://x.com/intent/post"), "the sample receipt shares through the X web intent");
  assert(sampleHtml.includes("Share your find on X"), "the sample receipt names the share button");
  assert(sampleHtml.includes("Quarter sheet pan and rack"), "the sample receipt uses the sample product title");
  assert(sampleHtml.includes(SAMPLE_ORDER_NUMBER), "the sample receipt uses the shared order number");
  assert(sampleHtml.includes("Usually ships in 2-4 business days"), "the sample receipt uses the sample ship window");
  assert(sampleHtml.includes(">Shipping<"), "the receipt labels the ship window Shipping");
  assert(sampleHtml.includes("100 Example Street"), "the sample receipt includes the placeholder street");
  assert(sampleHtml.includes("Sample City") && sampleHtml.includes("00000"), "the sample receipt includes the placeholder city and ZIP");
  assert(!sampleHtml.includes("Portland") && !sampleHtml.includes("97201") && !sampleHtml.includes("Elizabeth"), "the sample receipt has no real city or ZIP");
  assert(sampleHtml.includes(sans) && !sampleHtml.includes("Georgia"), "the sample receipt uses the email sans stack");
  assert(sampleHtml.includes('src="http://127.0.0.1:4317/brand/logo-official-xo.png"'), "the sample logo is an absolute APP_URL image");
  assert(sampleHtml.includes("max-width:480px") && sampleHtml.includes("btn-stack"), "the buttons stack on a narrow screen");
  assert(sampleHtml.includes("border:1px solid #23272d"), "the receipt button is an outline");
  assert(!sampleHtml.includes("padding:22px 0 0"), "the share button is not flush with the card edge");

  const captured = startMailCapture();
  getDb().prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(Date.now(), pending.order.id);
  await fulfillPaidOrder(pending.order.id);
  const customer = captured.find((message) => message.subject.startsWith("Thanks! We've got your XV-AIsle order"));
  const ops = captured.find((message) => message.subject.startsWith("New paid order"));
  const receiptHtmlSent = customer?.html ?? "";
  assert(customer?.text.includes(STREET), "the order email includes the supplier street");
  assert(receiptHtmlSent.includes(STREET), "the receipt html includes the supplier street");
  assert(!receiptHtmlSent.toLowerCase().includes("<script"), "the sent receipt html has no script");
  assert(receiptHtmlSent.includes("https://x.com/intent/post"), "the sent receipt html shares through the X web intent");
  assert(receiptHtmlSent.includes(sans) && receiptHtmlSent.includes('alt="XV-AISLE"'), "the sent receipt uses the sans stack and the logo");
  assert(ops && !ops.text.includes(STREET) && !ops.text.includes("100 Example Street"), "the ops alert has neither street");
  stopMailCapture();
  const stored = getOrder(pending.order.id);
  assert(stored?.returnLine1 === STREET, "fulfillment keeps the stored return address");

  process.env.DEMO_SEED = "1";
  process.env.STORE_OPERATOR_EMAIL = "returns-supplier@example.com";
  ensureStarterShelf();
  const sample = getDb().prepare("SELECT return_line1, return_city FROM listings WHERE product_id = 'sheet-pan'").get() as
    | { return_line1: string | null; return_city: string | null }
    | undefined;
  assert(sample != null && !sample.return_line1 && !sample.return_city, "sample data leaves the return address blank");
  const sampleListing = getListing("sheet-pan");
  assert(
    sampleListing && returnCopyForListing({ ...sampleListing, supplierAccountId: null }) === RETURNS_EMAILED,
    "an unconfirmed sample emails the return address later",
  );
  const scraper = getListing("bench-scraper");
  assert(
    sampleListing &&
      scraper &&
      sampleProductReturnNote(sampleListing, returnCopyForListing(sampleListing)) === RETURNS_EMAILED &&
      sampleProductReturnNote(scraper, returnCopyForListing(scraper)) === RETURNS_EMAILED,
    "both samples use the emailed return line",
  );

  getDb()
    .prepare(
      "UPDATE listings SET supplier_account_id = ?, supplier_cost_cents = 0, published = 1 WHERE product_id = 'sheet-pan'",
    )
    .run(supplierId);
  const heldSample = createPendingOrder({
    productId: "sheet-pan",
    qty: 1,
    ship: {
      name: "Sample Buyer",
      email: "sample-buyer@example.com",
      line1: "100 Example Street",
      city: CITY,
      region: REGION,
      postal: POSTAL,
      country: COUNTRY,
    },
  });
  assert("error" in heldSample, "a linked sample stays off checkout");
  ensureStarterShelf();
  const unlinked = getDb().prepare("SELECT supplier_account_id FROM listings WHERE product_id = 'sheet-pan'").get() as
    | { supplier_account_id: string | null }
    | undefined;
  assert(unlinked != null && unlinked.supplier_account_id == null, "the starter shelf drops the sample's supplier account");
  delete process.env.STRIPE_SECRET_KEY;
  const { GET: checkoutGet } = await import("../src/app/api/store/checkout/route");
  const { seedPreviewOrder } = await import("./seed-preview-order");
  await seedPreviewOrder();
  const previewResponse = await checkoutGet(
    new Request("http://127.0.0.1/api/store/checkout?session_id=cs_preview_sample_sheet_pan"),
  );
  const previewBody = (await previewResponse.json()) as { summary?: { title?: string; number?: string } };
  assert(previewResponse.status === 200 && previewBody.summary?.title === "Quarter sheet pan and rack", "a preview session renders without Stripe");
  assert(previewBody.summary?.number === SAMPLE_ORDER_NUMBER, "the preview session is the seeded order");
  delete process.env.DEMO_SEED;
  const closed = await checkoutGet(new Request("http://127.0.0.1/api/store/checkout?session_id=cs_preview_sample_sheet_pan"));
  assert(closed.status === 503, "the preview session does not skip Stripe unless DEMO_SEED=1");

  process.env.DEMO_SEED = "1";
  await seedPreviewOrder();
  const seededResponse = await checkoutGet(
    new Request("http://127.0.0.1/api/store/checkout?session_id=cs_preview_sample_sheet_pan"),
  );
  const seededBody = (await seededResponse.json()) as { summary?: { number?: string; returnAddress?: string | null } };
  assert(
    seededResponse.status === 200 && seededBody.summary?.number === SAMPLE_ORDER_NUMBER,
    "the seeded order uses the sample receipt number",
  );
  assert(seededBody.summary?.returnAddress === RETURNS_EMAILED, "an unconfirmed confirmation page emails the return address later");
  const sampleSupplier = getDb().prepare("SELECT id FROM accounts WHERE email = ?").get("sample-supplier@example.com") as
    | { id: string }
    | undefined;
  const supplierReturn = sampleSupplier
    ? (getDb().prepare("SELECT line1, city, region, postal, country FROM supplier_returns WHERE supplier_key = ?").get(
        `id:${sampleSupplier.id}`,
      ) as { line1: string; city: string; region: string; postal: string; country: string } | undefined)
    : undefined;
  assert(
    supplierReturn?.line1 === SAMPLE_RETURN_PARTS.line1 &&
      supplierReturn.city === SAMPLE_RETURN_PARTS.city &&
      supplierReturn.region === SAMPLE_RETURN_PARTS.region &&
      supplierReturn.postal === SAMPLE_RETURN_PARTS.postal &&
      supplierReturn.country === SAMPLE_RETURN_PARTS.country,
    "the seeded supplier stores the placeholder return address",
  );
  delete process.env.DEMO_SEED;

  closeDb();
  console.log("return address checks ok");
}

void main();
