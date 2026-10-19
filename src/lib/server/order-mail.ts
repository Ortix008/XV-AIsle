import { formatISODate } from "../business-days";
import { receiptShipWindow } from "../order-facts";
import { SAMPLE_ORDER_NUMBER, sampleReceiptFacts } from "../sample-shelf";
import { buyerShareHref } from "../x-share";
import { dollars } from "./fees";
import { sendMail } from "./mail";
import { appOrigin } from "./stripe";

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

function deskUrl() {
  return `${appOrigin()}/orders`;
}

export function receiptUrl(token: string) {
  return `${appOrigin()}/shop/order?token=${encodeURIComponent(token)}`;
}

export function delayRefundUrl(token: string) {
  return `${appOrigin()}/shop/order?delay=${encodeURIComponent(token)}`;
}

export function trackingUrl(carrier: string, tracking: string) {
  const name = carrier.trim().toLowerCase();
  const encoded = encodeURIComponent(tracking.trim());
  if (name.includes("ups")) return `https://www.ups.com/track?tracknum=${encoded}`;
  if (name.includes("usps") || name.includes("postal")) return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encoded}`;
  if (name.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${encoded}`;
  if (name.includes("dhl")) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encoded}`;
  return null;
}

export type ReceiptFacts = {
  number: string;
  title: string;
  qty: number;
  amountCents?: number | null;
  shipsFrom?: string | null;
  eta?: string | null;
  shipDaysMin?: number;
  shipDaysMax?: number;
  supplierName?: string | null;
  supplierUsConfirmed?: boolean | null;
  receiptUrl: string;
  returnAddress?: string | null;
  shareUrl?: string | null;
};

function shippingWindow(input: ReceiptFacts) {
  return receiptShipWindow(input.shipDaysMin, input.shipDaysMax, input);
}

function confirmedReturnAddress(address: string | null | undefined) {
  const place = address?.trim() ?? "";
  return place || null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function receiptText(input: ReceiptFacts) {
  const eta = shippingWindow(input);
  const returns = confirmedReturnAddress(input.returnAddress);
  const lines = [`Thanks for your order! Your order number is ${input.number}.`, "", input.title, `Qty ${input.qty}`];
  if (input.amountCents != null) lines.push(dollars(input.amountCents));
  if (input.shipsFrom?.trim()) lines.push(`Ships from ${input.shipsFrom.trim()}`);
  lines.push(`Shipping: ${eta}`);
  if (returns) lines.push("", "Need to send it back? Returns go to:", returns);
  lines.push("", `See your receipt: ${input.receiptUrl}`);
  if (input.shareUrl) lines.push(`Share your find on X: ${input.shareUrl}`);
  lines.push("");
  return lines.join("\n");
}

const EMAIL_SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function htmlRow(label: string, value: string) {
  return `<tr>
    <td bgcolor="#15181c" style="padding:8px 0;color:#b7b1a8;font-family:${EMAIL_SANS};font-size:14px;line-height:1.5;">${escapeHtml(label)}</td>
    <td bgcolor="#15181c" style="padding:8px 0 8px 16px;color:#f4f1ea;font-family:${EMAIL_SANS};font-size:16px;line-height:1.5;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Table button with a pill radius. Outlook gets a VML roundrect; other clients get the link. */
function buttonPaint(kind: "primary" | "outline") {
  switch (kind) {
    case "primary":
      return { bg: "#3ddc84", color: "#04140a", border: "#3ddc84" };
    case "outline":
      return { bg: "#15181c", color: "#f4f1ea", border: "#23272d" };
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function emailButton(input: { href: string; label: string; kind: "primary" | "outline" }) {
  const paint = buttonPaint(input.kind);
  const bg = paint.bg;
  const color = paint.color;
  const border = paint.border;
  const href = escapeHtml(input.href);
  const label = escapeHtml(input.label);
  return `<table role="presentation" class="btn-table" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
    <tr>
      <td align="center" bgcolor="${bg}" style="border-radius:999px;background-color:${bg};border:1px solid ${border};">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:46px;v-text-anchor:middle;width:220px;" arcsize="50%" strokecolor="${border}" strokeweight="1px" fillcolor="${bg}">
          <w:anchorlock/>
          <center style="color:${color};font-family:${EMAIL_SANS};font-size:15px;font-weight:bold;">${label}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-->
        <a class="btn-link" href="${href}" style="display:inline-block;padding:14px 22px;font-family:${EMAIL_SANS};font-size:15px;font-weight:700;line-height:1;color:${color};text-decoration:none;border-radius:999px;">${label}</a>
        <!--<![endif]-->
      </td>
    </tr>
  </table>`;
}

function actionRow(input: { receiptUrl: string; shareUrl?: string | null }) {
  const receipt = emailButton({ href: input.receiptUrl, label: "See your receipt:", kind: "outline" });
  const share = input.shareUrl
    ? `<td class="btn-stack" valign="top" style="padding:0;font-family:${EMAIL_SANS};">${emailButton({ href: input.shareUrl, label: "Share your find on X", kind: "primary" })}</td>
        <td class="btn-gap" width="12" style="width:12px;font-size:0;line-height:0;font-family:${EMAIL_SANS};">&nbsp;</td>`
    : "";
  return `<tr><td bgcolor="#15181c" style="padding:22px 28px 0;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      ${share}
      <td class="btn-stack" valign="top" style="padding:0;font-family:${EMAIL_SANS};">${receipt}</td>
    </tr></table>
  </td></tr>`;
}

/** Email-safe receipt. Inline styles, tables, dark background, light text, no script. */
export function receiptHtml(input: ReceiptFacts) {
  const eta = shippingWindow(input);
  const returns = confirmedReturnAddress(input.returnAddress);
  const rows = [
    htmlRow("Item", input.title),
    htmlRow("Qty", String(input.qty)),
    input.amountCents != null ? htmlRow("Paid", dollars(input.amountCents)) : "",
    input.shipsFrom?.trim() ? htmlRow("Ships from", input.shipsFrom.trim()) : "",
    htmlRow("Shipping", eta),
  ].join("");
  const returnsBlock = returns
    ? `<tr><td bgcolor="#15181c" style="padding:18px 28px 0;background-color:#15181c;color:#b7b1a8;font-family:${EMAIL_SANS};font-size:13px;letter-spacing:0.08em;">RETURNS</td></tr>
<tr><td bgcolor="#15181c" style="padding:6px 28px 0;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};font-size:15px;line-height:1.5;">Need to send it back? Returns go to:<br>${escapeHtml(returns).replace(/\n/g, "<br>")}</td></tr>`
    : "";
  const logo = `${appOrigin()}/brand/logo-official-xo.png`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Order ${escapeHtml(input.number)} received</title>
<style>
  @media only screen and (max-width:480px) {
    .btn-stack { display:block !important; width:100% !important; }
    .btn-gap { display:block !important; width:100% !important; height:12px !important; line-height:12px !important; }
    .btn-table { width:100% !important; }
    .btn-link { display:block !important; }
  }
</style>
</head>
<body bgcolor="#07080a" style="margin:0;padding:0;background-color:#07080a;color:#f4f1ea;font-family:${EMAIL_SANS};">
<table role="presentation" width="100%" bgcolor="#07080a" cellpadding="0" cellspacing="0" style="background-color:#07080a;color:#f4f1ea;font-family:${EMAIL_SANS};">
<tr><td align="center" bgcolor="#07080a" style="padding:28px 16px;background-color:#07080a;color:#f4f1ea;font-family:${EMAIL_SANS};">
<table role="presentation" width="560" bgcolor="#15181c" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};">
<tr><td bgcolor="#15181c" style="padding:24px 28px 16px;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};">
<img src="${escapeHtml(logo)}" alt="XV-AISLE" width="32" height="32" style="display:block;width:32px;height:32px;border:0;outline:none;text-decoration:none;">
</td></tr>
<tr><td bgcolor="#07080a" style="height:8px;background-color:#3ddc84;color:#f4f1ea;font-family:${EMAIL_SANS};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td bgcolor="#15181c" style="padding:28px 28px 8px;background-color:#15181c;color:#3ddc84;font-family:${EMAIL_SANS};font-size:12px;letter-spacing:0.16em;">ORDER ${escapeHtml(input.number)}</td></tr>
<tr><td bgcolor="#15181c" style="padding:0 28px 8px;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};font-size:28px;line-height:1.2;">Your order is in.</td></tr>
<tr><td bgcolor="#15181c" style="padding:0 28px 18px;background-color:#15181c;color:#b7b1a8;font-family:${EMAIL_SANS};font-size:15px;line-height:1.5;">You're all paid up. The supplier who has your item will pack it up and send it your way.</td></tr>
<tr><td bgcolor="#15181c" style="padding:0 28px;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr>
${returnsBlock}
${actionRow({ receiptUrl: input.receiptUrl, shareUrl: input.shareUrl })}
<tr><td bgcolor="#15181c" style="padding:0 28px 28px;background-color:#15181c;color:#f4f1ea;font-family:${EMAIL_SANS};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
<td bgcolor="#3ddc84" width="25%" style="height:4px;background-color:#3ddc84;font-family:${EMAIL_SANS};font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#e7c27a" width="25%" style="height:4px;background-color:#e7c27a;font-family:${EMAIL_SANS};font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#e3b4c4" width="25%" style="height:4px;background-color:#e3b4c4;font-family:${EMAIL_SANS};font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#7ddec4" width="25%" style="height:4px;background-color:#7ddec4;font-family:${EMAIL_SANS};font-size:0;line-height:0;">&nbsp;</td>
</tr></table>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function sampleReceiptHtml() {
  const sample = sampleReceiptFacts();
  const productUrl = `https://xvaisle.com/shop/${sample.productId}`;
  return receiptHtml({
    number: SAMPLE_ORDER_NUMBER,
    title: sample.title,
    qty: 1,
    amountCents: sample.amountCents,
    shipDaysMin: sample.shipDaysMin,
    shipDaysMax: sample.shipDaysMax,
    receiptUrl: "https://xvaisle.com/shop/order?token=sample",
    returnAddress: sample.returnAddress,
    shareUrl: buyerShareHref({ title: sample.title, productUrl }),
  });
}

export function shippedText(input: {
  number: string;
  title: string;
  carrier: string;
  tracking: string;
  receiptUrl: string;
}) {
  const link = trackingUrl(input.carrier, input.tracking);
  const lines = [
    `Good news, your order ${input.number} is on its way!`,
    "",
    input.title,
    `Carrier: ${input.carrier}`,
    `Tracking: ${input.tracking}`,
  ];
  if (link) lines.push(`Track your package: ${link}`);
  lines.push("", `Your receipt: ${input.receiptUrl}`, "");
  return lines.join("\n");
}

/** Ops alerts never receive a street, city, region, or postal code. */
export function opsAlertText(input: {
  kind: "new" | "reminder" | "email-copy";
  number: string;
  title: string;
  sku: string;
  qty: number;
  supplierOrderUrl: string | null;
}) {
  const intro =
    input.kind === "reminder"
      ? `Order ${input.number} is still not placed with the supplier. It has been waiting more than 24 hours.`
      : input.kind === "email-copy"
        ? `Order ${input.number} was emailed to the brand.`
        : `New paid order ${input.number} to place.`;
  return [
    intro,
    "",
    `Product: ${input.title}`,
    `SKU: ${input.sku}`,
    `Qty: ${input.qty}`,
    input.supplierOrderUrl ? `Supplier link: ${input.supplierOrderUrl}` : "Supplier link: not on the listing.",
    `Desk: ${deskUrl()}`,
    "",
  ].join("\n");
}

export function brandOrderText(input: {
  number: string;
  sku: string;
  title: string;
  qty: number;
  shipTo: {
    name: string;
    email: string;
    line1: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
}) {
  const ship = input.shipTo;
  return [
    `Please ship order ${input.number}.`,
    "",
    `SKU: ${input.sku}`,
    `Product: ${input.title}`,
    `Qty: ${input.qty}`,
    "",
    "Ship to:",
    ship.name,
    ship.line1,
    `${ship.city}, ${ship.region} ${ship.postal}`,
    ship.country,
    ship.email,
    "",
  ].join("\n");
}

/** Buyer mail after 7 business days with no shipment. No invented ship date. */
export function unshippedDelayText(input: { number: string; title: string; orderUrl: string }) {
  return [
    `We're sorry, your order ${input.number} hasn't shipped yet, and it's been 7 business days.`,
    "",
    input.title,
    "",
    "You're welcome to wait, or you can cancel for a full refund. It's your call.",
    "",
    `Your order: ${input.orderUrl}`,
    "",
  ].join("\n");
}

export function delayNoticeText(input: {
  number: string;
  title: string;
  expectedOn: string;
  refundUrl: string;
  receiptUrl: string;
}) {
  return [
    `We're sorry, your order ${input.number} is taking longer than we expected.`,
    "",
    input.title,
    `It should now ship by ${formatISODate(input.expectedOn)}.`,
    "",
    "If you'd rather not wait, you can get a full refund instead.",
    "",
    `Request a refund: ${input.refundUrl}`,
    `See your receipt: ${input.receiptUrl}`,
    "",
  ].join("\n");
}

function opsAddress() {
  return process.env.ORDER_ALERT_EMAIL?.trim() ?? "";
}

async function deliver(message: OutboundMail) {
  if (!message.to.trim()) {
    console.info(`Mail not sent (no address): ${message.subject}`);
    return { sent: false as const };
  }
  return sendMail(message);
}

export async function sendCustomerReceipt(input: {
  to: string;
  number: string;
  title: string;
  qty: number;
  amountCents?: number | null;
  shipsFrom?: string | null;
  eta?: string | null;
  shipDaysMin: number;
  shipDaysMax: number;
  supplierName?: string | null;
  supplierUsConfirmed?: boolean | null;
  token: string;
  productId?: string | null;
  returnAddress?: string | null;
}) {
  const link = receiptUrl(input.token);
  const shareUrl = input.productId
    ? buyerShareHref({ title: input.title, productUrl: `${appOrigin()}/shop/${input.productId}` })
    : null;
  const facts: ReceiptFacts = { ...input, receiptUrl: link, shareUrl };
  return deliver({
    to: input.to,
    subject: `Thanks! We've got your XV-AIsle order (${input.number})`,
    text: receiptText(facts),
    html: receiptHtml(facts),
  });
}

export async function sendShippedMail(input: {
  to: string;
  number: string;
  title: string;
  carrier: string;
  tracking: string;
  token: string;
}) {
  return deliver({
    to: input.to,
    subject: `Good news, your order ${input.number} is on its way!`,
    text: shippedText({ ...input, receiptUrl: receiptUrl(input.token) }),
  });
}

export async function sendOpsAlert(input: {
  kind: "new" | "reminder" | "email-copy";
  number: string;
  title: string;
  sku: string;
  qty: number;
  supplierOrderUrl: string | null;
}) {
  const subject =
    input.kind === "reminder"
      ? `Order ${input.number} still needs placing`
      : input.kind === "email-copy"
        ? `Order ${input.number} was sent to the brand`
        : `New paid order ${input.number}`;
  return deliver({
    to: opsAddress(),
    subject,
    text: opsAlertText(input),
  });
}

export async function sendBrandOrder(input: {
  to: string;
  number: string;
  sku: string;
  title: string;
  qty: number;
  shipTo: {
    name: string;
    email: string;
    line1: string;
    city: string;
    region: string;
    postal: string;
    country: string;
  };
}) {
  return deliver({
    to: input.to,
    subject: `Order ${input.number} to ship`,
    text: brandOrderText(input),
  });
}

export async function sendUnshippedDelayMail(input: {
  to: string;
  number: string;
  title: string;
  refundToken: string;
}) {
  return deliver({
    to: input.to,
    subject: `An update on your order ${input.number}`,
    text: unshippedDelayText({
      number: input.number,
      title: input.title,
      orderUrl: delayRefundUrl(input.refundToken),
    }),
  });
}

export async function sendDelayNoticeMail(input: {
  to: string;
  number: string;
  title: string;
  expectedOn: string;
  refundToken: string;
  receiptToken: string;
}) {
  return deliver({
    to: input.to,
    subject: `Your order ${input.number} is running late`,
    text: delayNoticeText({
      number: input.number,
      title: input.title,
      expectedOn: input.expectedOn,
      refundUrl: delayRefundUrl(input.refundToken),
      receiptUrl: receiptUrl(input.receiptToken),
    }),
  });
}
