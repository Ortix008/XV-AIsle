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

  const { RETURNS_ON_ORDER, RETURNS_UNSET, parseReturnAddress } = await import("../src/lib/return-address");
  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { SAMPLE_ORDER_NUMBER, SAMPLE_RETURN_ADDRESS, SAMPLE_RETURN_PARTS } = await import("../src/lib/sample-shelf");
  const { receiptHtml, receiptText, sampleReceiptHtml } = await import("../src/lib/server/order-mail");
  const { buyerOrder, presentOrder, publicListing, resellerListing } = await import("../src/lib/server/order-view");
  const { saveReturnsAddress } = await import("../src/lib/server/settings");
  const { ensureStarterShelf } = await import("../src/lib/server/starter-shelf");
  const { createPendingOrder, fulfillPaidOrder, getListing, getOrder, publishListing } = await import("../src/lib/server/store");
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
  assert(storeReturnCopy() === RETURNS_UNSET, "no address yet uses the fallback");

  const saved = saveSupplierReturn(admin, `id:${supplierId}`, address);
  assert(!("error" in saved) && saved.address?.line1 === STREET, "an operator can save a supplier return address");
  assert(storeReturnCopy() === RETURNS_ON_ORDER, "a saved supplier address changes the policy line");
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
  assert(returnCopyForListing(published.listing) === RETURNS_ON_ORDER, "the product page points at the order page");
  const publicJson = JSON.stringify(publicListing(published.listing));
  const resellerJson = JSON.stringify(resellerListing(published.listing));
  assert(!publicJson.includes(STREET) && !publicJson.includes("returnLine1"), "the public listing omits the street");
  assert(!resellerJson.includes(STREET), "a reseller listing omits the street");

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
  assert(returnCopyForListing(named.listing) === RETURNS_UNSET, "a blank supplier uses the fallback");
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
  assert(receiptBody.order?.returnAddress?.includes(STREET), "the order page includes the street");
  assert(!receiptBody.order?.returnAddress?.includes("100 Example Street"), "the order page does not swap in the ship-to street");

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
  assert(blankReceipt.includes(RETURNS_UNSET), "the receipt email uses the fallback");
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
  assert(blankHtml.includes(RETURNS_UNSET), "the receipt html uses the fallback");
  assert(!blankHtml.includes("Ships from") && !blankHtml.includes("Arrival"), "blank receipt html omits empty facts");
  assert(!blankHtml.toLowerCase().includes("<script"), "the receipt html has no script");
  assert(blankHtml.includes('bgcolor="#07080a"') && blankHtml.includes("color:#f4f1ea"), "the receipt html is dark with a light-text fallback");
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
  assert(blankHtml.includes(sans) && !blankHtml.includes("Georgia"), "the receipt html uses the email sans stack");
  assert(blankHtml.includes('alt="XV-AISLE"') && blankHtml.includes('width="32"'), "the receipt html includes the logo");
  assert(blankHtml.includes("/brand/logo-official-xo.png"), "the logo is the brand image");
  assert(blankHtml.includes("border-radius:999px") && blankHtml.includes("Your receipt"), "the receipt link is a pill button");
  assert(blankHtml.includes("padding:22px 28px 0"), "the receipt button sits in the content padding");
  const sampleHtml = sampleReceiptHtml();
  assert(sampleHtml.includes("https://x.com/intent/post"), "the sample receipt shares through the X web intent");
  assert(sampleHtml.includes("Share your find on X"), "the sample receipt names the share button");
  assert(sampleHtml.includes("Quarter sheet pan and rack"), "the sample receipt uses the sample product title");
  assert(sampleHtml.includes(SAMPLE_ORDER_NUMBER), "the sample receipt uses the shared order number");
  assert(sampleHtml.includes("Ships in 2-4 business days."), "the sample receipt uses the sample ship window");
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
  const customer = captured.find((message) => message.subject.endsWith("received"));
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
  assert(sampleListing && returnCopyForListing({ ...sampleListing, supplierAccountId: null }) === RETURNS_UNSET, "a sample with no address uses the fallback");

  getDb()
    .prepare(
      "UPDATE listings SET supplier_account_id = ?, supplier_cost_cents = 0, published = 1 WHERE product_id = 'sheet-pan'",
    )
    .run(supplierId);
  const preview = createPendingOrder({
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
  if ("error" in preview) throw new Error(preview.error);
  getDb()
    .prepare("UPDATE orders SET status = 'paid', paid_at = ?, stripe_session_id = ? WHERE id = ?")
    .run(Date.now(), "cs_preview_sample_sheet_pan", preview.order.id);
  delete process.env.STRIPE_SECRET_KEY;
  const { GET: checkoutGet } = await import("../src/app/api/store/checkout/route");
  const previewResponse = await checkoutGet(
    new Request("http://127.0.0.1/api/store/checkout?session_id=cs_preview_sample_sheet_pan"),
  );
  const previewBody = (await previewResponse.json()) as { summary?: { title?: string; number?: string } };
  assert(previewResponse.status === 200 && previewBody.summary?.title === "Quarter sheet pan and rack", "a preview session renders without Stripe");
  assert(previewBody.summary?.number === preview.order.number, "the preview session is the seeded order");
  delete process.env.DEMO_SEED;
  const closed = await checkoutGet(new Request("http://127.0.0.1/api/store/checkout?session_id=cs_preview_sample_sheet_pan"));
  assert(closed.status === 503, "the preview session does not skip Stripe unless DEMO_SEED=1");

  process.env.DEMO_SEED = "1";
  const { seedPreviewOrder } = await import("./seed-preview-order");
  await seedPreviewOrder();
  const seededResponse = await checkoutGet(
    new Request("http://127.0.0.1/api/store/checkout?session_id=cs_preview_sample_sheet_pan"),
  );
  const seededBody = (await seededResponse.json()) as { summary?: { number?: string; returnAddress?: string | null } };
  assert(
    seededResponse.status === 200 && seededBody.summary?.number === SAMPLE_ORDER_NUMBER,
    "the seeded order uses the sample receipt number",
  );
  assert(seededBody.summary?.returnAddress === SAMPLE_RETURN_ADDRESS, "the confirmation page shows the placeholder return address");
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
