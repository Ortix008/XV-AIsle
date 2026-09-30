import { createHmac, timingSafeEqual } from "node:crypto";

export type CheckoutKind = "membership" | "order";

export type StripeSession = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string | null;
  customer: string | null;
  subscription: string | null;
  amount_total: number | null;
  metadata: Record<string, string>;
};

function key() {
  const value = process.env.STRIPE_SECRET_KEY;
  if (!value) return null;
  return value;
}

export function stripeConfigured() {
  return Boolean(key());
}

export function appOrigin() {
  return (process.env.APP_URL ?? "http://127.0.0.1:4317").replace(/\/$/, "");
}

export async function createCheckoutSession(input: {
  kind: CheckoutKind;
  accountId: string;
  orderId?: string;
  name: string;
  amountCents: number;
  quantity?: number;
  customerEmail?: string;
  successPath: string;
  cancelPath: string;
}) {
  const secret = key();
  if (!secret) throw new Error("Stripe is not configured.");
  const origin = appOrigin();
  const body = new URLSearchParams();
  body.set("mode", input.kind === "membership" ? "subscription" : "payment");
  body.set("success_url", `${origin}${input.successPath}`);
  body.set("cancel_url", `${origin}${input.cancelPath}`);
  body.set("metadata[kind]", input.kind);
  body.set("metadata[account_id]", input.accountId);
  if (input.orderId) body.set("metadata[order_id]", input.orderId);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  body.set("excluded_payment_method_types[0]", "us_bank_account");
  body.set("excluded_payment_method_types[1]", "cashapp");
  body.set("excluded_payment_method_types[2]", "klarna");
  body.set("excluded_payment_method_types[3]", "amazon_pay");
  body.set("excluded_payment_method_types[4]", "pay_by_bank");
  body.set("phone_number_collection[enabled]", "false");
  body.set("line_items[0][quantity]", String(input.quantity ?? 1));
  body.set("line_items[0][price_data][currency]", "usd");
  body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
  body.set("line_items[0][price_data][product_data][name]", input.name);
  if (input.kind === "membership") {
    body.set("line_items[0][price_data][recurring][interval]", "month");
  }
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json()) as StripeSession & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Stripe did not open checkout.");
  }
  return payload;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const secret = key();
  if (!secret) throw new Error("Stripe is not configured.");
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const payload = (await response.json()) as StripeSession & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(payload.error?.message ?? "Stripe did not return that checkout.");
  }
  return payload;
}

export async function cancelSubscription(subscriptionId: string) {
  const secret = key();
  if (!secret) return;
  await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${secret}` },
  });
}

export function verifyStripeSignature(rawBody: string, header: string | null, secret: string) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const [name, value] = part.split("=");
      return [name, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
