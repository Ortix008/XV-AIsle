import { createHmac, timingSafeEqual } from "node:crypto";

/** Header carrying `t=<unix seconds>,v1=<hex hmac>`. */
export const SUPPLIER_SIGNATURE_HEADER = "x-supplier-signature";

const MAX_AGE_SECONDS = 5 * 60;

function supplierWebhookSecret() {
  const secret = process.env.SUPPLIER_WEBHOOK_SECRET?.trim() ?? "";
  return secret.length > 0 ? secret : null;
}

/**
 * HMAC-SHA256 over `${timestamp}.${rawBody}`, compared in constant time.
 * Rejects a missing header, a bad digest, or a timestamp outside five minutes.
 */
export function supplierSignatureMatches(rawBody: string, header: string | null, secret: string) {
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
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const left = Buffer.from(expected);
  for (const signature of signatures) {
    const right = Buffer.from(signature);
    if (left.length !== right.length) continue;
    if (timingSafeEqual(left, right)) return true;
  }
  return false;
}

/** Refuse the callback when the env secret is unset, or the signature does not match. */
export function authorizeSupplierWebhook(rawBody: string, header: string | null) {
  const secret = supplierWebhookSecret();
  if (!secret) {
    return { ok: false as const, status: 503 as const, error: "Supplier webhook secret is not set." };
  }
  if (!supplierSignatureMatches(rawBody, header, secret)) {
    return { ok: false as const, status: 401 as const, error: "Supplier signature did not match." };
  }
  return { ok: true as const };
}
