import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { TRIAL_DAYS } from "../account";

export type CheckoutKind = "membership" | "order";

export type StripeChargeOutcome = {
  risk_level?: string | null;
  type?: string | null;
};

export type StripeBalanceTransaction = {
  id?: string;
  fee?: number;
};

export type StripeCharge = {
  id?: string;
  outcome?: StripeChargeOutcome | null;
  balance_transaction?: string | StripeBalanceTransaction | null;
};

export type StripePaymentIntent = {
  id: string;
  latest_charge?: string | StripeCharge | null;
};

export type StripeSession = {
  id: string;
  url: string | null;
  status: string | null;
  payment_status: string | null;
  customer: string | null;
  subscription: string | null;
  amount_total: number | null;
  metadata: Record<string, string>;
  payment_intent?: string | StripePaymentIntent | null;
};

const DEFAULT_VERSION = "2026-07-29.dahlia";
const LIVE_PREFIXES = [`${["sk", "live"].join("_")}_`, `${["rk", "live"].join("_")}_`];

let stripeFetchImpl: typeof fetch = fetch;

export function setStripeFetch(impl: typeof fetch | null) {
  stripeFetchImpl = impl ?? fetch;
}

export function isLiveKey(value: string) {
  return LIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function key() {
  const value = process.env.STRIPE_SECRET_KEY?.trim();
  return value || null;
}

export function stripeConfigured() {
  return Boolean(key());
}

export function stripeVersion() {
  return process.env.STRIPE_API_VERSION?.trim() || DEFAULT_VERSION;
}

export function appOrigin() {
  return (process.env.APP_URL ?? "http://127.0.0.1:4317").replace(/\/$/, "");
}

function secretOrThrow() {
  const secret = key();
  if (!secret) throw new Error("Stripe is not configured.");
  if (isLiveKey(secret) && process.env.STRIPE_ALLOW_LIVE !== "1") {
    throw new Error("Live Stripe keys are refused. Use a test key.");
  }
  return secret;
}

function stripeMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "Stripe refused the request.";
  const record = payload as { error?: { message?: string }; message?: string };
  return record.error?.message || record.message || "Stripe refused the request.";
}

async function stripeSend(path: string, init: RequestInit) {
  const response = await stripeFetchImpl(`https://api.stripe.com${path}`, init);
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = {};
    }
  }
  if (!response.ok) throw new Error(stripeMessage(payload));
  return payload;
}

function authHeaders(extra?: Record<string, string>) {
  return {
    Authorization: `Bearer ${secretOrThrow()}`,
    "Stripe-Version": stripeVersion(),
    ...extra,
  };
}

export function stripeGet(path: string) {
  return stripeSend(path, { headers: authHeaders() });
}

export function stripeForm(path: string, body: URLSearchParams, idempotencyKey: string) {
  return stripeSend(path, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": idempotencyKey,
    }),
    body,
  });
}

export function stripeJson(path: string, body: unknown, idempotencyKey: string) {
  return stripeSend(path, {
    method: "POST",
    headers: authHeaders({
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    }),
    body: JSON.stringify(body),
  });
}

function integrationSuffix(seed: string) {
  const digest = createHash("sha256").update(seed).digest();
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 8; i += 1) suffix += alphabet[digest[i] % 26];
  return suffix;
}

export async function createCheckoutSession(input: {
  kind: CheckoutKind;
  accountId: string;
  orderId?: string;
  transferGroup?: string;
  name: string;
  amountCents: number;
  quantity?: number;
  customerEmail?: string;
  successPath: string;
  cancelPath: string;
  attemptId?: string;
}) {
  const origin = appOrigin();
  const idempotencyKey =
    input.kind === "order" && input.orderId
      ? `checkout-order-${input.orderId}`
      : `checkout-membership-${input.accountId}-${input.attemptId ?? randomUUID()}`;
  const body = new URLSearchParams();
  body.set("mode", input.kind === "membership" ? "subscription" : "payment");
  body.set("success_url", `${origin}${input.successPath}`);
  body.set("cancel_url", `${origin}${input.cancelPath}`);
  body.set("client_reference_id", input.kind === "order" && input.orderId ? input.orderId : input.accountId);
  body.set("metadata[kind]", input.kind);
  body.set("metadata[account_id]", input.accountId);
  body.set("integration_identifier", `xvaisle_${input.kind}_${integrationSuffix(idempotencyKey)}`);
  if (input.orderId) body.set("metadata[order_id]", input.orderId);
  if (input.customerEmail) body.set("customer_email", input.customerEmail);
  body.set("excluded_payment_method_types[0]", "us_bank_account");
  body.set("excluded_payment_method_types[1]", "cashapp");
  body.set("excluded_payment_method_types[2]", "klarna");
  body.set("excluded_payment_method_types[3]", "amazon_pay");
  body.set("excluded_payment_method_types[4]", "pay_by_bank");
  body.set("phone_number_collection[enabled]", "false");
  const priceId = input.kind === "membership" ? process.env.STRIPE_MEMBERSHIP_PRICE_ID?.trim() : "";
  if (priceId) {
    body.set("line_items[0][quantity]", "1");
    body.set("line_items[0][price]", priceId);
  } else {
    body.set("line_items[0][quantity]", String(input.quantity ?? 1));
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][unit_amount]", String(input.amountCents));
    body.set("line_items[0][price_data][product_data][name]", input.name);
    if (input.kind === "membership") {
      body.set("line_items[0][price_data][recurring][interval]", "month");
    }
  }
  if (input.kind === "membership") {
    body.set("subscription_data[trial_period_days]", String(TRIAL_DAYS));
    body.set("subscription_data[metadata][kind]", "membership");
    body.set("subscription_data[metadata][account_id]", input.accountId);
  } else if (input.orderId) {
    body.set("payment_intent_data[transfer_group]", input.transferGroup || `order_${input.orderId}`);
    body.set("payment_intent_data[metadata][kind]", "order");
    body.set("payment_intent_data[metadata][order_id]", input.orderId);
    body.set("payment_intent_data[metadata][account_id]", input.accountId);
  }
  return (await stripeForm("/v1/checkout/sessions", body, idempotencyKey)) as StripeSession;
}

export async function retrieveCheckoutSession(sessionId: string) {
  const query = new URLSearchParams();
  query.append("expand[]", "payment_intent.latest_charge.balance_transaction");
  return (await stripeGet(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}?${query}`)) as StripeSession;
}

export async function retrievePaymentIntent(paymentIntentId: string) {
  const query = new URLSearchParams();
  query.append("expand[]", "latest_charge.balance_transaction");
  return (await stripeGet(
    `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}?${query}`,
  )) as StripePaymentIntent;
}

function stripeFeeCents(charge: StripeCharge) {
  const balance = charge.balance_transaction;
  if (!balance || typeof balance === "string") return null;
  if (typeof balance.fee !== "number" || !Number.isInteger(balance.fee) || balance.fee < 0) return null;
  return balance.fee;
}

export function readPaidCharge(session: StripeSession) {
  const paymentIntent = session.payment_intent;
  if (!paymentIntent) {
    return { paymentIntentId: null, chargeId: null, riskLevel: null, riskType: null, stripeFeeCents: null };
  }
  if (typeof paymentIntent === "string") {
    return { paymentIntentId: paymentIntent, chargeId: null, riskLevel: null, riskType: null, stripeFeeCents: null };
  }
  const charge = paymentIntent.latest_charge;
  if (!charge || typeof charge === "string") {
    return {
      paymentIntentId: paymentIntent.id,
      chargeId: typeof charge === "string" ? charge : null,
      riskLevel: null,
      riskType: null,
      stripeFeeCents: null,
    };
  }
  return {
    paymentIntentId: paymentIntent.id,
    chargeId: charge.id ?? null,
    riskLevel: charge.outcome?.risk_level ?? null,
    riskType: charge.outcome?.type ?? null,
    stripeFeeCents: stripeFeeCents(charge),
  };
}

export type StripeSubscription = {
  id: string;
  status?: string;
  customer?: string | null;
  metadata?: Record<string, string>;
};

export async function retrieveSubscription(subscriptionId: string) {
  return (await stripeGet(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`)) as StripeSubscription;
}

export async function cancelSubscription(subscriptionId: string) {
  const secret = key();
  if (!secret) return;
  secretOrThrow();
  await stripeSend(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function createRecipientAccount(input: { email: string; name: string; idempotencyKey: string }) {
  return stripeJson(
    "/v2/core/accounts",
    {
      contact_email: input.email,
      display_name: input.name,
      dashboard: "express",
      identity: { country: "us" },
      configuration: {
        recipient: {
          capabilities: {
            stripe_balance: {
              stripe_transfers: { requested: true },
            },
          },
        },
      },
      defaults: {
        currency: "usd",
        responsibilities: {
          fees_collector: "application",
          losses_collector: "application",
        },
      },
      include: ["configuration.recipient", "requirements"],
    },
    input.idempotencyKey,
  );
}

export async function retrieveConnectedAccount(stripeAccountId: string) {
  const query = new URLSearchParams();
  query.append("include", "configuration.recipient");
  query.append("include", "requirements");
  return stripeGet(`/v2/core/accounts/${encodeURIComponent(stripeAccountId)}?${query}`);
}

export async function createOnboardingLink(input: {
  stripeAccountId: string;
  refreshUrl: string;
  returnUrl: string;
  idempotencyKey: string;
}) {
  const payload = (await stripeJson(
    "/v2/core/account_links",
    {
      account: input.stripeAccountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          configurations: ["recipient"],
          refresh_url: input.refreshUrl,
          return_url: input.returnUrl,
        },
      },
    },
    input.idempotencyKey,
  )) as { url?: string };
  if (!payload.url) throw new Error("Stripe did not return an onboarding link.");
  return payload.url;
}

export async function createLoginLink(stripeAccountId: string) {
  const payload = (await stripeForm(
    `/v1/accounts/${encodeURIComponent(stripeAccountId)}/login_links`,
    new URLSearchParams(),
    `login-${stripeAccountId}-${randomUUID()}`,
  )) as { url?: string };
  if (!payload.url) throw new Error("Stripe did not return a dashboard link.");
  return payload.url;
}

export async function createTransfer(input: {
  amountCents: number;
  destination: string;
  chargeId: string;
  transferGroup: string;
  idempotencyKey: string;
  orderId: string;
  party: string;
  accountId: string;
}) {
  const body = new URLSearchParams();
  body.set("amount", String(input.amountCents));
  body.set("currency", "usd");
  body.set("destination", input.destination);
  body.set("source_transaction", input.chargeId);
  body.set("transfer_group", input.transferGroup);
  body.set("metadata[order_id]", input.orderId);
  body.set("metadata[party]", input.party);
  body.set("metadata[account_id]", input.accountId);
  return (await stripeForm("/v1/transfers", body, input.idempotencyKey)) as { id?: string };
}

export async function reverseTransfer(input: { transferId: string; amountCents: number; idempotencyKey: string }) {
  const body = new URLSearchParams();
  body.set("amount", String(input.amountCents));
  return stripeForm(
    `/v1/transfers/${encodeURIComponent(input.transferId)}/reversals`,
    body,
    input.idempotencyKey,
  );
}

export function verifyStripeSignature(rawBody: string, header: string | null, secret: string) {
  if (!header || !secret) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const name = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (name === "t") timestamp = value;
    if (name === "v1" && value) signatures.push(value);
  }
  if (!timestamp || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 5 * 60) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const left = Buffer.from(expected);
  for (const signature of signatures) {
    const right = Buffer.from(signature);
    if (left.length !== right.length) continue;
    if (timingSafeEqual(left, right)) return true;
  }
  return false;
}
