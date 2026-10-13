import { poBoxRejection } from "../return-address";
import type { Actor } from "./access";
import { settingsWriteDecision } from "./access";
import { getDb } from "./db";

const RETURNS_KEY = "returns_address";
const SUPPORT_EMAIL_KEY = "support_email";

/** Shown when the operator has not saved a support address. */
export const PUBLISHED_SUPPORT_EMAIL = "xvaisle.team@gmail.com";

function readSetting(key: string, envName: "STORE_RETURNS" | "STORE_SUPPORT_EMAIL") {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  const stored = row?.value.trim() ?? "";
  if (stored) return stored;
  return process.env[envName]?.trim() ?? "";
}

export function readReturnsAddress() {
  return readSetting(RETURNS_KEY, "STORE_RETURNS");
}

export function readSupportEmail() {
  return readSetting(SUPPORT_EMAIL_KEY, "STORE_SUPPORT_EMAIL");
}

export function saveReturnsAddress(value: string) {
  const address = value.trim().replace(/\s+/g, " ");
  if (address.length > 200) return { error: "Shorten the return address." as const };
  if (address.length > 0 && address.length < 8) return { error: "Add the street, city, and state." as const };
  const poBox = poBoxRejection(address);
  if (poBox) return { error: poBox };
  const db = getDb();
  if (!address) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(RETURNS_KEY);
    return { address: "" };
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(RETURNS_KEY, address);
  return { address };
}

const SUPPORT_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isSupportEmail(value: string) {
  return SUPPORT_EMAIL.test(value);
}

/** Operator setting or STORE_SUPPORT_EMAIL when valid, otherwise the published address. */
export function supportEmailForDisplay() {
  const stored = readSupportEmail();
  return isSupportEmail(stored) ? stored : PUBLISHED_SUPPORT_EMAIL;
}

export function saveSupportEmail(value: string) {
  const email = value.trim().toLowerCase();
  if (email.length > 120) return { error: "Shorten the support email." as const };
  if (email && !SUPPORT_EMAIL.test(email)) return { error: "Use a full email address." as const };
  const db = getDb();
  if (!email) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(SUPPORT_EMAIL_KEY);
    return { email: "" };
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(SUPPORT_EMAIL_KEY, email);
  return { email };
}

export function saveReturnsFor(account: Actor | null, returns: string) {
  const decision = settingsWriteDecision(account);
  if (decision) return decision;
  const saved = saveReturnsAddress(returns);
  if ("error" in saved) return { status: 400 as const, error: saved.error };
  return { status: 200 as const, returns: saved.address };
}

export function saveSupportFor(account: Actor | null, email: string) {
  const decision = settingsWriteDecision(account);
  if (decision) return decision;
  const saved = saveSupportEmail(email);
  if ("error" in saved) return { status: 400 as const, error: saved.error };
  return { status: 200 as const, supportEmail: saved.email };
}
