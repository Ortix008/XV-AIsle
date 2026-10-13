import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-route-")), "route.sqlite");
delete process.env.SUPPLIER_API_URL;
delete process.env.SUPPLIER_API_KEY;
delete process.env.SMTP_HOST;
delete process.env.MAIL_FROM;
delete process.env.STRIPE_ALLOW_LIVE;
process.env.ORDER_ALERT_EMAIL = "ops@example.com";

const SUPPLIER_URL = "https://example.invalid/hidden-supplier-order";
const SUPPLIER_EMAIL = "supplier-orders@example.invalid";
const STREET = "100 Example Street";
const CITY = "Sample City";
const POSTAL = "00000";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const shipTo = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: STREET,
  city: CITY,
  region: "ST",
  postal: POSTAL,
  country: "US",
};

async function main() {
  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { addBusinessDays } = await import("../src/lib/business-days");
  const { setMailDelivery, startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { delayFor, placeFor, shipFor } = await import("../src/lib/server/order-actions");
  const { acceptDelayRefund, flagShippingDelays, remindUnplacedOrders } = await import("../src/lib/server/order-routing");
  const { buyerOrder, presentOrder, publicListing, resellerListing } = await import("../src/lib/server/order-view");
  const { setStripeFetch } = await import("../src/lib/server/stripe");
  const { createPendingOrder, fulfillPaidOrder, getListing, getOrder, publishListing } = await import("../src/lib/server/store");
  const { TRACKING_STALE_MS } = await import("../src/lib/order-flags");

  const monday = Date.UTC(2026, 9, 5, 15, 0, 0);
  assert(new Date(addBusinessDays(monday, 1)).toISOString() === "2026-10-06T23:59:59.999Z", "one business day lands on Tuesday");
  assert(new Date(addBusinessDays(monday, 7)).toISOString() === "2026-10-14T23:59:59.999Z", "seven business days lands on the next Wednesday");
  assert(
    new Date(addBusinessDays(Date.UTC(2026, 9, 9, 12), 1)).toISOString() === "2026-10-12T23:59:59.999Z",
    "Friday plus one business day is Monday",
  );
  assert(
    new Date(addBusinessDays(Date.UTC(2026, 9, 14, 15), 7)).toISOString() === "2026-10-23T23:59:59.999Z",
    "a refund chosen Wednesday is due the Friday after next",
  );

  const joined = signUp({ name: "Example Seller", email: "routing@example.com", password: "market-test" });
  if ("error" in joined || !joined.account) throw new Error("error" in joined ? joined.error : "account");
  const sellerId = joined.account.id;
  const admin = {
    id: sellerId,
    role: "admin" as const,
    memberSince: 1,
    membershipStatus: "active",
    emailVerified: true,
    totpEnabled: true,
  };
  const reseller = { ...admin, role: "reseller" as const, totpEnabled: false };
  const noTotp = { ...admin, totpEnabled: false };

  function publish(
    productId: string,
    extra: { route?: "manual" | "email" | "api"; shipDaysMin?: number; shipDaysMax?: number; supplierOrderUrl?: string; supplierEmail?: string } = {},
  ) {
    const result = publishListing(sellerId, {
      productId,
      sku: "RT-1",
      title: "Route pan",
      description: "A pan for the routing check.",
      priceCents: 2000,
      image: "",
      supplierName: "Example Supply",
      supplierOrigin: "US",
      shipDaysMin: extra.shipDaysMin ?? 3,
      shipDaysMax: extra.shipDaysMax ?? 8,
      supplierAccountId: sellerId,
      supplierCostCents: 500,
      route: extra.route,
      supplierOrderUrl: extra.supplierOrderUrl,
      supplierEmail: extra.supplierEmail,
    });
    if ("error" in result || !result.listing) throw new Error("listing");
    return result.listing;
  }

  async function paid(productId: string) {
    const pending = createPendingOrder({ productId, qty: 1, ship: shipTo });
    if ("error" in pending) throw new Error(pending.error);
    getDb().prepare("UPDATE orders SET status = 'paid', paid_at = ? WHERE id = ?").run(Date.now(), pending.order.id);
    return pending.order.id;
  }

  const manual = publish("route-manual", { route: "manual", supplierOrderUrl: SUPPLIER_URL });
  assert(manual.supplierOrderUrl === SUPPLIER_URL, "the supplier link is stored for the desk");
  const captured = startMailCapture();
  const manualId = await paid("route-manual");
  const placed = await fulfillPaidOrder(manualId);
  assert(placed?.status === "needs_placing", "a manual route waits to be placed");
  const ops = captured.filter((message) => message.subject.startsWith("New paid order"));
  const receipts = captured.filter((message) => message.subject.endsWith("received"));
  assert(ops.length === 1, "a manual route sends one ops email");
  assert(receipts.length === 1, "the customer gets a receipt");
  assert(!ops[0]?.text.includes(STREET) && !ops[0]?.text.includes(CITY) && !ops[0]?.text.includes(POSTAL), "the ops alert has no street address");
  assert(ops[0]?.text.includes(SUPPLIER_URL), "the ops alert includes the supplier link");
  assert(!receipts[0]?.text.includes(SUPPLIER_URL), "the receipt does not include the supplier link");

  setMailDelivery(async () => {
    throw new Error("mail down");
  });
  const failedId = await paid("route-manual");
  const failed = await fulfillPaidOrder(failedId);
  assert(failed?.status === "needs_placing", "a mail failure still leaves the order placed in the desk");
  setMailDelivery(null);

  publish("route-email", { route: "email", supplierEmail: SUPPLIER_EMAIL, supplierOrderUrl: SUPPLIER_URL });
  const beforeEmail = captured.length;
  const emailedId = await paid("route-email");
  const emailed = await fulfillPaidOrder(emailedId);
  assert(emailed?.status === "sent_to_supplier", "an email route is sent to the brand");
  const brand = captured.slice(beforeEmail).find((message) => message.to === SUPPLIER_EMAIL);
  const copy = captured.slice(beforeEmail).find((message) => message.subject.includes("sent to the brand"));
  assert(brand?.text.includes(STREET), "the brand email includes the ship-to address");
  assert(copy && !copy.text.includes(STREET) && !copy.text.includes(POSTAL), "the ops copy of a brand email has no street address");

  publish("route-hidden", {
    route: "manual",
    supplierOrderUrl: SUPPLIER_URL,
    supplierEmail: SUPPLIER_EMAIL,
    shipDaysMax: 8,
  });
  const hidden = getListing("route-hidden");
  assert(hidden?.supplierOrderUrl === SUPPLIER_URL && hidden.supplierEmail === SUPPLIER_EMAIL, "private fields are on the server listing");
  const publicJson = JSON.stringify(publicListing(hidden!));
  const resellerJson = JSON.stringify(resellerListing(hidden!));
  assert(!publicJson.includes(SUPPLIER_URL) && !publicJson.includes(SUPPLIER_EMAIL), "public pages omit the supplier link and email");
  assert(!resellerJson.includes(SUPPLIER_URL) && !resellerJson.includes(SUPPLIER_EMAIL), "a reseller listing omits the supplier link and email");
  assert(!resellerJson.includes("supplierCostCents"), "a reseller listing omits supplier cost");
  assert(!resellerJson.includes("wholesaleCost") && !resellerJson.includes("wholesale_cost"), "a reseller listing omits wholesale cost");

  const { GET: catalogGet } = await import("../src/app/api/store/catalog/route");
  const { GET: listingsGet } = await import("../src/app/api/store/listings/route");
  const { GET: productGet } = await import("../src/app/api/store/listings/[productId]/route");
  const catalogJson = JSON.stringify(await (await catalogGet()).json());
  const listingsJson = JSON.stringify(await (await listingsGet(new Request("http://127.0.0.1/api/store/listings"))).json());
  const productJson = JSON.stringify(await (await productGet(new Request("http://127.0.0.1/api"), { params: Promise.resolve({ productId: "route-hidden" }) })).json());
  for (const body of [catalogJson, listingsJson, productJson]) {
    assert(!body.includes(SUPPLIER_URL) && !body.includes(SUPPLIER_EMAIL) && !body.includes("supplierOrderUrl"), "a public API leaked a supplier field");
  }

  const viewOrder = getOrder(manualId)!;
  const adminJson = JSON.stringify(presentOrder(admin, viewOrder, hidden));
  const resellerView = JSON.stringify(presentOrder(reseller, viewOrder, hidden));
  const supplierView = JSON.stringify(presentOrder({ role: "supplier" }, viewOrder, hidden));
  assert(adminJson.includes(SUPPLIER_URL), "the admin desk can see the supplier link");
  assert(!resellerView.includes(SUPPLIER_URL) && !resellerView.includes(SUPPLIER_EMAIL), "a reseller order hides the supplier link and email");
  assert(!supplierView.includes(SUPPLIER_URL) && !supplierView.includes("supplierPaidCents"), "a supplier order hides the supplier link");
  const buyerJson = JSON.stringify(buyerOrder({ ...viewOrder, supplierPaidCents: 4242 }));
  assert(!buyerJson.includes("supplierPaidCents") && !buyerJson.includes(SUPPLIER_URL), "a buyer order hides supplier payment and the supplier link");

  const denied = placeFor(reseller, manualId, { supplierRef: "MY-100", supplierCostCents: 500 });
  assert("error" in denied && denied.status === 403, "a reseller cannot mark an order placed");
  const needsTotp = placeFor(noTotp, manualId, { supplierRef: "MY-100", supplierCostCents: 500 });
  assert("error" in needsTotp && needsTotp.status === 403, "mark ordered needs an authenticator");
  assert(getOrder(manualId)?.status === "needs_placing", "a refused mark ordered leaves the order");
  const ordered = placeFor(admin, manualId, { supplierRef: "MY-100", supplierCostCents: 1599 });
  if (!("order" in ordered) || !ordered.order) throw new Error("expected the order to be marked placed");
  assert(ordered.order.status === "ordered", "an admin with an authenticator can mark ordered");
  assert(ordered.order.supplierRef === "MY-100" && ordered.order.supplierPaidCents === 1599, "the supplier order number and amount are saved");

  getDb().prepare("UPDATE orders SET number = 'XV-1001', status = 'paid' WHERE id = ?").run(failedId);
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response("no", { status: 500 });
  }) as typeof fetch;
  process.env.SUPPLIER_API_URL = "https://supplier.test/orders";
  process.env.SUPPLIER_API_KEY = "test-key";
  getDb().prepare("UPDATE listings SET route = 'api' WHERE product_id = 'route-manual'").run();
  const blocked = await fulfillPaidOrder(failedId);
  assert(blocked?.status === "test", "XV-1001 is not routed");
  assert(calls.length === 0, "XV-1001 is not sent to a supplier");
  const blockedPlace = placeFor(admin, failedId, { supplierRef: "MY-100", supplierCostCents: 100 });
  assert("error" in blockedPlace, "XV-1001 cannot be marked ordered");
  assert(getOrder(failedId)?.status === "test", "XV-1001 stays a test order");
  globalThis.fetch = originalFetch;
  delete process.env.SUPPLIER_API_URL;
  delete process.env.SUPPLIER_API_KEY;
  getDb().prepare("UPDATE listings SET route = 'manual' WHERE product_id = 'route-manual'").run();

  const waitingId = await paid("route-manual");
  await fulfillPaidOrder(waitingId);
  getDb().prepare("UPDATE orders SET paid_at = ? WHERE id = ?").run(Date.now() - 25 * 60 * 60 * 1000, waitingId);
  const beforeReminder = captured.length;
  await remindUnplacedOrders();
  const reminders = captured.slice(beforeReminder).filter((message) => message.subject.includes("still needs placing"));
  assert(reminders.length === 1, "a 24 hour wait sends one reminder");
  assert(!reminders[0]?.text.includes(STREET), "the reminder has no street address");
  await remindUnplacedOrders();
  const again = captured.slice(beforeReminder).filter((message) => message.subject.includes("still needs placing"));
  assert(again.length === 1, "the 24 hour reminder is sent once");
  const waitingView = presentOrder(admin, getOrder(waitingId)!, hidden, Date.now());
  assert("placingOverdue" in waitingView && waitingView.placingOverdue, "the desk flags a 24 hour wait");

  publish("route-window", { shipDaysMin: 1, shipDaysMax: 1 });
  const insideId = await paid("route-window");
  getDb().prepare("UPDATE orders SET status = 'needs_placing', paid_at = ? WHERE id = ?").run(monday, insideId);
  flagShippingDelays(Date.UTC(2026, 9, 6, 12));
  assert(getOrder(insideId)?.delayFlaggedAt == null, "an order inside its ship window is not flagged");
  flagShippingDelays(Date.UTC(2026, 9, 7, 12));
  assert(getOrder(insideId)?.delayFlaggedAt != null, "an order past its ship window is flagged");

  publish("route-open", { shipDaysMin: 0, shipDaysMax: 0 });
  const openId = await paid("route-open");
  getDb().prepare("UPDATE orders SET status = 'needs_placing', paid_at = ? WHERE id = ?").run(monday, openId);
  flagShippingDelays(Date.UTC(2026, 9, 14, 12));
  assert(getOrder(openId)?.delayFlaggedAt == null, "seven business days have not elapsed");
  flagShippingDelays(Date.UTC(2026, 9, 15, 0));
  assert(getOrder(openId)?.delayFlaggedAt != null, "no ship window means 7 business days");

  const notice = await delayFor(noTotp, openId, "2026-10-21");
  assert("error" in notice && notice.status === 403, "the delay notice needs an authenticator");
  const sent = await delayFor(admin, openId, "2026-10-21");
  assert(!("error" in sent), "an admin can send the delay notice");
  const delayMail = captured.find((message) => message.subject.includes("delayed") && message.text.includes("XV-"));
  assert(delayMail?.text.includes("October 21, 2026"), "the delay notice gives the new date");
  assert(delayMail?.text.includes("full refund"), "the delay notice offers a full refund");
  assert(!delayMail?.text.includes(STREET), "the delay notice has no street address");
  const token = delayMail?.text.match(/delay=([a-f0-9]+)/)?.[1] ?? "";
  assert(token.length >= 32, "the delay notice includes a refund link");

  const refundAt = Date.UTC(2026, 9, 14, 15);
  getDb().prepare("UPDATE orders SET charge_id = 'ch_delay', payment_intent_id = 'pi_delay' WHERE id = ?").run(openId);
  let refundCalls = 0;
  setStripeFetch(async (input, init) => {
    refundCalls += 1;
    const url = String(input);
    assert(url.includes("/v1/refunds"), "the refund goes to Stripe");
    const headers = new Headers(init?.headers);
    assert(headers.get("authorization") === "Bearer sk_test_routing", "the refund uses a test key");
    return new Response(JSON.stringify({ id: "re_test", status: "succeeded" }), { status: 200 });
  });
  process.env.STRIPE_SECRET_KEY = "sk_test_routing";
  const refunded = await acceptDelayRefund(token, refundAt);
  if (refunded.status !== 200 || !("order" in refunded) || !refunded.order) throw new Error("expected the delay refund to be recorded");
  assert(refunded.order.status === "refunded", "the refund is recorded");
  const due = addBusinessDays(refundAt, 7);
  assert(refunded.order.delayRefundDueAt === due, "the refund is due in 7 working days");
  assert((refunded.order.delayRefundedAt ?? 0) <= due, "the Stripe refund lands inside the 7 working days");
  assert(refundCalls === 1, "Stripe was asked to refund once");

  publish("route-live", { shipDaysMax: 1 });
  const liveId = await paid("route-live");
  getDb().prepare("UPDATE orders SET status = 'needs_placing', paid_at = ?, charge_id = 'ch_live' WHERE id = ?").run(monday, liveId);
  flagShippingDelays(Date.UTC(2026, 9, 20, 12));
  const liveNotice = await delayFor(admin, liveId, "2026-10-21");
  assert(!("error" in liveNotice), "the live-key order can be noticed");
  const liveToken = captured.filter((message) => message.subject.includes("delayed")).at(-1)?.text.match(/delay=([a-f0-9]+)/)?.[1] ?? "";
  process.env.STRIPE_SECRET_KEY = "sk_live_routing";
  delete process.env.STRIPE_ALLOW_LIVE;
  const beforeLive = refundCalls;
  const refused = await acceptDelayRefund(liveToken, refundAt);
  assert(refused.status === 502 && "error" in refused && refused.error.includes("due by"), "a live Stripe key is refused");
  assert(getOrder(liveId)?.status !== "refunded" && getOrder(liveId)?.delayRefundedAt == null, "a refused live refund is not marked refunded");
  assert(getOrder(liveId)?.delayRefundRequestedAt === refundAt, "a refused refund still records the request");
  assert(getOrder(liveId)?.delayRefundDueAt === due, "a refused refund keeps the 7 working day due date");
  assert(refundCalls === beforeLive, "a live key never calls Stripe");
  setStripeFetch(null);
  delete process.env.STRIPE_SECRET_KEY;

  const shipId = await paid("route-manual");
  await fulfillPaidOrder(shipId);
  const shipped = shipFor(admin, shipId, { carrier: "UPS", tracking: "1Z999AA10123456784" });
  if (!("order" in shipped) || !shipped.order) throw new Error("expected tracking to mark the order shipped");
  assert(shipped.order.status === "shipped", "saving tracking marks the order shipped");
  assert(shipped.order.trackingUpdatedAt != null, "an admin tracking save records the time");
  const shippedMail = captured.find((message) => message.subject.includes("shipped") && message.text.includes("1Z999AA10123456784"));
  assert(shippedMail?.text.includes("https://www.ups.com/track"), "the shipped email includes the tracking link");
  const fresh = Date.now();
  const freshView = presentOrder(admin, shipped.order, hidden, fresh);
  assert("trackingStale" in freshView && !freshView.trackingStale, "a new tracking save is not stale");
  getDb().prepare("UPDATE orders SET tracking_updated_at = ? WHERE id = ?").run(fresh - TRACKING_STALE_MS, shipId);
  const staleView = presentOrder(admin, getOrder(shipId)!, hidden, fresh);
  assert("trackingStale" in staleView && staleView.trackingStale, "tracking last saved 3 days ago is flagged");
  getDb().prepare("UPDATE orders SET tracking_updated_at = ? WHERE id = ?").run(fresh - TRACKING_STALE_MS + 1000, shipId);
  const recentView = presentOrder(admin, getOrder(shipId)!, hidden, fresh);
  assert("trackingStale" in recentView && !recentView.trackingStale, "tracking saved inside 3 days is not flagged");

  stopMailCapture();
  closeDb();
  console.log("routing checks ok");
}

main();
