export type PayoutMethod = "card" | "bank" | "bitcoin" | "dogecoin";

export type PayoutOnFile = {
  method: PayoutMethod;
  last4: string;
};

const LEGACY_KEY = "xvaisle-payout-v2";
const CLAIM_KEY = "xvaisle-payout-legacy-owner";

export function payoutStorageKey(accountId: string) {
  return `xvaisle-payout-v3:${accountId}`;
}

function asMethod(value: unknown): PayoutOnFile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as PayoutOnFile;
  if (typeof row.last4 !== "string" || row.last4.length !== 4) return null;
  if (row.method !== "card" && row.method !== "bank" && row.method !== "bitcoin" && row.method !== "dogecoin") {
    return null;
  }
  return { method: row.method, last4: row.last4 };
}

let cachedAccount = "";
let cachedRaw = "";
let cachedMargin: PayoutOnFile | null = null;

function readRaw(accountId: string) {
  const key = payoutStorageKey(accountId);
  if (!window.localStorage.getItem(key)) claimLegacy(accountId);
  return window.localStorage.getItem(key) ?? "";
}

function claimLegacy(accountId: string) {
  const owner = window.localStorage.getItem(CLAIM_KEY);
  if (owner && owner !== accountId) return;
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (!raw) return;
  window.localStorage.setItem(payoutStorageKey(accountId), raw);
  window.localStorage.setItem(CLAIM_KEY, accountId);
  window.localStorage.removeItem(LEGACY_KEY);
}

export function readMargin(accountId: string): PayoutOnFile | null {
  if (typeof window === "undefined" || !accountId) return null;
  try {
    const raw = readRaw(accountId);
    if (accountId === cachedAccount && raw === cachedRaw) return cachedMargin;
    const parsed = raw ? (JSON.parse(raw) as { margin?: unknown }) : null;
    cachedAccount = accountId;
    cachedRaw = raw;
    cachedMargin = parsed ? asMethod(parsed.margin) : null;
    return cachedMargin;
  } catch {
    return null;
  }
}

export function subscribePayout(onStoreChange: () => void) {
  window.addEventListener("xvaisle-payout", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("xvaisle-payout", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function writeMargin(accountId: string, margin: PayoutOnFile) {
  const raw = JSON.stringify({ margin });
  window.localStorage.setItem(payoutStorageKey(accountId), raw);
  cachedAccount = accountId;
  cachedRaw = raw;
  cachedMargin = margin;
  window.dispatchEvent(new Event("xvaisle-payout"));
}

export function payoutLabel(payout: PayoutOnFile) {
  if (payout.method === "card") return `Card ···· ${payout.last4}`;
  if (payout.method === "bank") return `Bank ···· ${payout.last4}`;
  if (payout.method === "bitcoin") return "Bitcoin wallet";
  return "Dogecoin wallet";
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function luhn(value: string) {
  let sum = 0;
  let alt = false;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    let digit = Number(value[index]);
    if (alt) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function routingOk(value: string) {
  if (!/^\d{9}$/.test(value)) return false;
  const d = value.split("").map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

function expiryOk(value: string, now = new Date()) {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(value.trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  return new Date(year, month, 1) > now;
}

export function checkCard(input: { name: string; number: string; expiry: string }) {
  if (input.name.trim().length < 2) return "Enter the name on the card.";
  const number = digits(input.number);
  if (number.length < 13 || number.length > 19 || !luhn(number)) return "That card number does not check out.";
  if (!expiryOk(input.expiry)) return "Enter an expiration that is still ahead, as MM/YY.";
  return null;
}

export function checkBank(input: { routing: string; account: string }) {
  const routing = digits(input.routing);
  const account = digits(input.account);
  if (!routingOk(routing)) return "That routing number does not check out.";
  if (account.length < 4 || account.length > 17) return "Enter the account number.";
  return null;
}

export function checkWallet(method: "bitcoin" | "dogecoin", address: string) {
  const value = address.trim();
  if (method === "bitcoin") {
    const ok = /^(bc1[ac-hj-np-z02-9]{11,71}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})$/.test(value);
    return ok ? null : "Enter a Bitcoin address.";
  }
  const ok = /^D[1-9A-HJ-NP-Za-km-z]{25,40}$/.test(value);
  return ok ? null : "Enter a Dogecoin address.";
}

export function cardOnFile(number: string): PayoutOnFile {
  const clean = digits(number);
  return { method: "card", last4: clean.slice(-4) };
}

export function bankOnFile(account: string): PayoutOnFile {
  const clean = digits(account);
  return { method: "bank", last4: clean.slice(-4) };
}

export function walletOnFile(method: "bitcoin" | "dogecoin"): PayoutOnFile {
  return { method, last4: "0000" };
}
