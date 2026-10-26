import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-delay-")), "delay.sqlite");
process.env.REQUIRE_SUPPLIER_CONFIRMED = "0";
delete process.env.SMTP_HOST;
delete process.env.MAIL_FROM;
delete process.env.STRIPE_SECRET_KEY;
delete process.env.STRIPE_ALLOW_LIVE;
delete process.env.STORE_HOLIDAYS;
delete process.env.DEMO_SEED;

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const shipTo = {
  name: "Example Buyer",
  email: "buyer@example.com",
  line1: "100 Example Street",
  city: "Sample City",
  region: "ST",
  postal: "00000",
  country: "US",
};

const monday = Date.UTC(2026, 9, 5, 15, 0, 0);
const holiday = new Set(["2026-10-12"]);

async function main() {
  const page = readFileSync(join(process.cwd(), "src/app/shop/how-we-check/page.tsx"), "utf8");
  assert(page.includes("A real person replies within 2 business days."), "the reply promise is 2 business days");
  assert(
    page.includes("If your order hasn't shipped within 7 business days, we'll email you with an update and your options."),
    "the late-shipping promise is the 7 business day email",
  );
  assert(!page.includes("REPLY_WITHIN_HOURS") && !page.includes("within 24 hours"), "the how-we-check page drops the 24 hour reply");

  const { addBusinessDays, addBusinessDaysSkipping, parseHolidayList } = await import("../src/lib/business-days");
  assert(new Date(addBusinessDays(monday, 7)).toISOString() === "2026-10-14T23:59:59.999Z", "seven business days skip the weekend");
  assert(
    new Date(addBusinessDaysSkipping(monday, 7, holiday)).toISOString() === "2026-10-15T23:59:59.999Z",
    "a holiday inside the window pushes the seventh business day out",
  );
  assert(
    new Date(addBusinessDaysSkipping(Date.UTC(2026, 9, 9, 12), 1, holiday)).toISOString() === "2026-10-13T23:59:59.999Z",
    "Friday plus one business day skips the weekend and a Monday holiday",
  );
  const parsed = parseHolidayList("2026-10-12, no, 2026-02-31, 2026-12-25");
  assert(parsed.has("2026-10-12") && parsed.has("2026-12-25") && parsed.size === 2, "only real dates stay on the holiday list");

  const { closeDb, getDb } = await import("../src/lib/server/db");
  const { signUp } = await import("../src/lib/server/accounts");
  const { startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { notifyUnshippedDelays } = await import("../src/lib/server/order-routing");
  const { createPendingOrder, getOrder, publishListing } = await import("../src/lib/server/store");

  const joined = signUp({ name: "Example Seller", email: "delay@example.com", password: "market-test" });
  if ("error" in joined || !joined.account) throw new Error("error" in joined ? joined.error : "account");
  const sellerId = joined.account.id;
  const published = publishListing(sellerId, {
    productId: "delay-pan",
    sku: "DL-1",
    title: "Delay pan",
    description: "A pan for the delay check.",
    priceCents: 2000,
    image: "",
    supplierName: "Example Supply",
    supplierOrigin: "US",
    shipDaysMin: 1,
    shipDaysMax: 1,
    supplierAccountId: sellerId,
    supplierCostCents: 500,
  });
  if ("error" in published) throw new Error(published.error);

  function paid(paidAt: number) {
    const pending = createPendingOrder({ productId: "delay-pan", qty: 1, ship: shipTo });
    if ("error" in pending) throw new Error(pending.error);
    getDb().prepare("UPDATE orders SET status = 'needs_placing', paid_at = ? WHERE id = ?").run(paidAt, pending.order.id);
    return pending.order.id;
  }

  const captured = startMailCapture();
  const waitingId = paid(monday);
  const early = await notifyUnshippedDelays(Date.UTC(2026, 9, 7, 12), new Set());
  assert(early.noticed === 0, "a one-day ship window does not email before 7 business days");
  assert(getOrder(waitingId)?.delayNoticeSentAt == null, "the early order has no delay notice");

  const due = await notifyUnshippedDelays(Date.UTC(2026, 9, 15, 0), new Set());
  assert(due.noticed === 1, "the order is emailed once it is past 7 business days");
  const mail = captured.filter((message) => message.subject.startsWith("An update on your order"));
  assert(mail.length === 1, "one delay email is handed to the mailer");
  assert(mail[0]?.text.includes("it's been 7 business days"), "the email says the order has not shipped");
  assert(mail[0]?.text.includes("wait") && mail[0]?.text.includes("full refund"), "the email offers waiting or a full refund");
  assert(mail[0]?.text.includes("/shop/order?delay="), "the email links to the order page");
  assert(!mail[0]?.text.includes("100 Example Street"), "the delay email has no street address");
  const again = await notifyUnshippedDelays(Date.UTC(2026, 9, 16, 0), new Set());
  assert(again.noticed === 0 && captured.filter((message) => message.subject.startsWith("An update on your order")).length === 1, "the delay email is not sent twice");
  assert(getOrder(waitingId)?.delayNoticeSentAt != null, "the send is recorded on the order");

  const shippedId = paid(monday);
  getDb().prepare("UPDATE orders SET status = 'shipped', shipped_at = ? WHERE id = ?").run(monday, shippedId);
  const refundedId = paid(monday);
  getDb().prepare("UPDATE orders SET status = 'refunded', had_refund = 1 WHERE id = ?").run(refundedId);
  const blockedId = paid(monday);
  getDb().prepare("UPDATE orders SET number = 'XV-1001', status = 'paid' WHERE id = ?").run(blockedId);
  const beforeSkip = captured.length;
  const skipped = await notifyUnshippedDelays(Date.UTC(2026, 9, 20, 0), new Set());
  assert(skipped.noticed === 0, "shipped, refunded, and blocked orders are not emailed");
  assert(captured.length === beforeSkip, "skipped orders do not hand a message to the mailer");
  assert(getOrder(shippedId)?.delayNoticeSentAt == null, "a shipped order is not marked noticed");
  assert(getOrder(refundedId)?.delayNoticeSentAt == null, "a refunded order is not marked noticed");

  const holidayId = paid(monday);
  const duringHoliday = await notifyUnshippedDelays(Date.UTC(2026, 9, 15, 0), holiday);
  assert(duringHoliday.noticed === 0 && getOrder(holidayId)?.delayNoticeSentAt == null, "a holiday keeps the order inside 7 business days");
  const afterHoliday = await notifyUnshippedDelays(Date.UTC(2026, 9, 16, 0), holiday);
  assert(afterHoliday.noticed === 1, "the holiday order is emailed on the following business day");

  stopMailCapture();
  closeDb();
  console.log("delay notice checks ok");
}

void main();
