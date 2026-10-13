import { formatISODate } from "../business-days";
import { sendMail } from "./mail";
import { appOrigin } from "./stripe";

export type OutboundMail = {
  to: string;
  subject: string;
  text: string;
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

function shipWindow(min: number, max: number) {
  if (!max) return "Ships in 7 business days.";
  if (min > 0 && min !== max) return `Ships in ${min}-${max} business days.`;
  return `Ships in ${max} business days.`;
}

export function receiptText(input: {
  number: string;
  title: string;
  qty: number;
  shipDaysMin: number;
  shipDaysMax: number;
  receiptUrl: string;
}) {
  return [
    `Order ${input.number} received.`,
    "",
    input.title,
    `Qty ${input.qty}`,
    shipWindow(input.shipDaysMin, input.shipDaysMax),
    "",
    `Your receipt: ${input.receiptUrl}`,
    "",
  ].join("\n");
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
  shipDaysMin: number;
  shipDaysMax: number;
  token: string;
}) {
  const link = receiptUrl(input.token);
  return deliver({
    to: input.to,
    subject: `Order ${input.number} received`,
    text: receiptText({ ...input, receiptUrl: link }),
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
