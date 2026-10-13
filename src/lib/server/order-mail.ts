import { formatISODate } from "../business-days";
import { RETURNS_UNSET } from "../return-address";
import { sampleReceiptFacts } from "../sample-shelf";
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
  receiptUrl: string;
  returnAddress?: string | null;
  shareUrl?: string | null;
};

function receiptEta(input: ReceiptFacts) {
  if (input.eta?.trim()) return input.eta.trim();
  const max = input.shipDaysMax ?? 0;
  const min = input.shipDaysMin ?? 0;
  if (max <= 0) return null;
  if (min > 0 && min !== max) return `Ships in ${min}-${max} business days.`;
  return `Ships in ${max} business days.`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function receiptText(input: ReceiptFacts) {
  const eta = receiptEta(input);
  const returns = input.returnAddress?.trim()
    ? ["Returns ship back to the supplier at:", input.returnAddress.trim()]
    : [RETURNS_UNSET];
  const lines = [`Order ${input.number} received.`, "", input.title, `Qty ${input.qty}`];
  if (input.amountCents != null) lines.push(dollars(input.amountCents));
  if (input.shipsFrom?.trim()) lines.push(`Ships from ${input.shipsFrom.trim()}`);
  if (eta) lines.push(eta);
  lines.push("", ...returns, "", `Your receipt: ${input.receiptUrl}`);
  if (input.shareUrl) lines.push(`Share your find on X: ${input.shareUrl}`);
  lines.push("");
  return lines.join("\n");
}

function htmlRow(label: string, value: string) {
  return `<tr>
    <td bgcolor="#15181c" style="padding:8px 0;color:#b7b1a8;font-family:Georgia,serif;font-size:14px;line-height:1.5;">${escapeHtml(label)}</td>
    <td bgcolor="#15181c" style="padding:8px 0 8px 16px;color:#f4f1ea;font-family:Georgia,serif;font-size:16px;line-height:1.5;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Email-safe receipt. Inline styles, tables, dark background, light text, no script. */
export function receiptHtml(input: ReceiptFacts) {
  const eta = receiptEta(input);
  const returns = input.returnAddress?.trim() || RETURNS_UNSET;
  const rows = [
    htmlRow("Item", input.title),
    htmlRow("Qty", String(input.qty)),
    input.amountCents != null ? htmlRow("Paid", dollars(input.amountCents)) : "",
    input.shipsFrom?.trim() ? htmlRow("Ships from", input.shipsFrom.trim()) : "",
    eta ? htmlRow("Arrival", eta) : "",
  ].join("");
  const share = input.shareUrl
    ? `<tr><td colspan="2" bgcolor="#15181c" style="padding:22px 0 0;color:#f4f1ea;">
        <a href="${escapeHtml(input.shareUrl)}" style="display:inline-block;background-color:#3ddc84;color:#04140a;font-family:Georgia,serif;font-size:15px;font-weight:700;text-decoration:none;padding:12px 18px;">Share your find on X</a>
      </td></tr>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<title>Order ${escapeHtml(input.number)} received</title>
</head>
<body bgcolor="#07080a" style="margin:0;padding:0;background-color:#07080a;color:#f4f1ea;">
<table role="presentation" width="100%" bgcolor="#07080a" cellpadding="0" cellspacing="0" style="background-color:#07080a;color:#f4f1ea;">
<tr><td align="center" bgcolor="#07080a" style="padding:28px 16px;background-color:#07080a;color:#f4f1ea;">
<table role="presentation" width="560" bgcolor="#15181c" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background-color:#15181c;color:#f4f1ea;">
<tr><td bgcolor="#07080a" style="height:8px;background-color:#3ddc84;color:#f4f1ea;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td bgcolor="#15181c" style="padding:28px 28px 8px;background-color:#15181c;color:#3ddc84;font-family:Georgia,serif;font-size:12px;letter-spacing:0.16em;">ORDER ${escapeHtml(input.number)}</td></tr>
<tr><td bgcolor="#15181c" style="padding:0 28px 8px;background-color:#15181c;color:#f4f1ea;font-family:Georgia,serif;font-size:28px;line-height:1.2;">Your order is in.</td></tr>
<tr><td bgcolor="#15181c" style="padding:0 28px 18px;background-color:#15181c;color:#b7b1a8;font-family:Georgia,serif;font-size:15px;line-height:1.5;">Paid on xvaisle.com. The supplier ships the box.</td></tr>
<tr><td bgcolor="#15181c" style="padding:0 28px;background-color:#15181c;color:#f4f1ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
</td></tr>
<tr><td bgcolor="#15181c" style="padding:18px 28px 0;background-color:#15181c;color:#b7b1a8;font-family:Georgia,serif;font-size:13px;letter-spacing:0.08em;">RETURNS</td></tr>
<tr><td bgcolor="#15181c" style="padding:6px 28px 0;background-color:#15181c;color:#f4f1ea;font-family:Georgia,serif;font-size:15px;line-height:1.5;">${escapeHtml(returns).replace(/\n/g, "<br>")}</td></tr>
<tr><td bgcolor="#15181c" style="padding:18px 28px 0;background-color:#15181c;color:#f4f1ea;font-family:Georgia,serif;font-size:15px;line-height:1.5;"><a href="${escapeHtml(input.receiptUrl)}" style="color:#3ddc84;">Your receipt</a></td></tr>
${share}
<tr><td bgcolor="#15181c" style="padding:0 28px 28px;background-color:#15181c;color:#f4f1ea;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px;"><tr>
<td bgcolor="#3ddc84" width="25%" style="height:4px;background-color:#3ddc84;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#e7c27a" width="25%" style="height:4px;background-color:#e7c27a;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#e3b4c4" width="25%" style="height:4px;background-color:#e3b4c4;font-size:0;line-height:0;">&nbsp;</td>
<td bgcolor="#7ddec4" width="25%" style="height:4px;background-color:#7ddec4;font-size:0;line-height:0;">&nbsp;</td>
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
    number: "XV-1002",
    title: sample.title,
    qty: 1,
    amountCents: sample.amountCents,
    eta: sample.eta,
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
    `Order ${input.number} shipped.`,
    "",
    input.title,
    `Carrier: ${input.carrier}`,
    `Tracking: ${input.tracking}`,
  ];
  if (link) lines.push(`Track: ${link}`);
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
    `Order ${input.number} has not shipped within 7 business days.`,
    "",
    input.title,
    "",
    "You can wait, or cancel for a full refund.",
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
    `Order ${input.number} has not shipped within the time we promised.`,
    "",
    input.title,
    `The new expected date is ${formatISODate(input.expectedOn)}.`,
    "",
    "You can choose a full refund instead. If you do, we refund the charge in Stripe within 7 working days.",
    "",
    `Request a refund: ${input.refundUrl}`,
    `Your receipt: ${input.receiptUrl}`,
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
    subject: `Order ${input.number} received`,
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
    subject: `Order ${input.number} shipped`,
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
    subject: `Order ${input.number} has not shipped`,
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
    subject: `Order ${input.number} delayed`,
    text: delayNoticeText({
      number: input.number,
      title: input.title,
      expectedOn: input.expectedOn,
      refundUrl: delayRefundUrl(input.refundToken),
      receiptUrl: receiptUrl(input.receiptToken),
    }),
  });
}
