import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "./db";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import {
  checkBank,
  checkCard,
  checkWallet,
  type PayoutMethod,
  type PayoutOnFile,
} from "../payout";

const MONTH = 30 * 24 * 60 * 60 * 1000;

export type PublicAccount = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  memberSince: number | null;
};

type AccountRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: number;
  member_since: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function publicAccount(row: AccountRow): PublicAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    memberSince: row.member_since,
  };
}

export function signUp(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return { error: "Add your name." as const };
  if (email.length > 120 || !email.includes("@") || !email.includes(".")) {
    return { error: "That email does not look right." as const };
  }
  if (input.password.length < 8) return { error: "Use at least 8 characters." as const };
  if (input.password.length > 200) return { error: "Use a shorter password." as const };
  const db = getDb();
  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email) as { id: string } | undefined;
  if (existing) return { error: "That email already has an account. Sign in instead." as const };
  const { salt, hash } = hashPassword(input.password);
  const account: AccountRow = {
    id: randomUUID(),
    name,
    email,
    password_hash: hash,
    password_salt: salt,
    created_at: Date.now(),
    member_since: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  };
  db.prepare(
    `INSERT INTO accounts (id, name, email, password_hash, password_salt, created_at, member_since, stripe_customer_id, stripe_subscription_id)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)`,
  ).run(account.id, account.name, account.email, account.password_hash, account.password_salt, account.created_at);
  return { account: publicAccount(account), token: openSession(account.id) };
}

export function signIn(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (email.length > 120 || input.password.length > 200) {
    return { error: "That email or password does not match." as const };
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM accounts WHERE email = ?").get(email) as AccountRow | undefined;
  if (!row) {
    burnPasswordCheck(input.password);
    return { error: "That email and password do not match." as const };
  }
  if (!verifyPassword(input.password, row.password_salt, row.password_hash)) {
    return { error: "That email and password do not match." as const };
  }
  return { account: publicAccount(row), token: openSession(row.id) };
}

function openSession(accountId: string) {
  const token = randomBytes(32).toString("hex");
  getDb()
    .prepare("INSERT INTO sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash(token), accountId, Date.now() + MONTH);
  return token;
}

export function accountFromToken(token: string | undefined | null) {
  if (!token) return null;
  const db = getDb();
  const session = db
    .prepare("SELECT account_id, expires_at FROM sessions WHERE token_hash = ?")
    .get(tokenHash(token)) as { account_id: string; expires_at: number } | undefined;
  if (!session || session.expires_at < Date.now()) return null;
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(session.account_id) as AccountRow | undefined;
  return row ? publicAccount(row) : null;
}

export function endSession(token: string | undefined | null) {
  if (!token) return;
  getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
}

export function readPayout(accountId: string): PayoutOnFile | null {
  const row = getDb()
    .prepare("SELECT method, last4 FROM payouts WHERE account_id = ?")
    .get(accountId) as { method: PayoutMethod; last4: string } | undefined;
  if (!row) return null;
  if (row.method !== "card" && row.method !== "bank" && row.method !== "bitcoin" && row.method !== "dogecoin") {
    return null;
  }
  return { method: row.method, last4: row.last4 };
}

export function savePayout(
  accountId: string,
  input: {
    method: PayoutMethod;
    name?: string;
    number?: string;
    expiry?: string;
    routing?: string;
    account?: string;
    address?: string;
  },
) {
  let last4 = "";
  if (input.method === "card") {
    const problem = checkCard({ name: input.name ?? "", number: input.number ?? "", expiry: input.expiry ?? "" });
    if (problem) return { error: problem };
    const digits = (input.number ?? "").replace(/\D/g, "");
    last4 = digits.slice(-4);
  } else if (input.method === "bank") {
    const problem = checkBank({ routing: input.routing ?? "", account: input.account ?? "" });
    if (problem) return { error: problem };
    const digits = (input.account ?? "").replace(/\D/g, "");
    last4 = digits.slice(-4);
  } else {
    const problem = checkWallet(input.method, input.address ?? "");
    if (problem) return { error: problem };
    last4 = "0000";
  }
  getDb()
    .prepare(
      `INSERT INTO payouts (account_id, method, last4, wallet) VALUES (?, ?, ?, NULL)
       ON CONFLICT(account_id) DO UPDATE SET method = excluded.method, last4 = excluded.last4, wallet = NULL`,
    )
    .run(accountId, input.method, last4);
  return { payout: { method: input.method, last4 } satisfies PayoutOnFile };
}

export function markMember(accountId: string, stripeCustomerId: string | null, stripeSubscriptionId: string | null) {
  getDb()
    .prepare(
      `UPDATE accounts
       SET member_since = COALESCE(member_since, ?),
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           stripe_subscription_id = COALESCE(?, stripe_subscription_id)
       WHERE id = ?`,
    )
    .run(Date.now(), stripeCustomerId, stripeSubscriptionId, accountId);
}

export function clearMembership(accountId: string) {
  const row = getDb()
    .prepare("SELECT stripe_subscription_id FROM accounts WHERE id = ?")
    .get(accountId) as { stripe_subscription_id: string | null } | undefined;
  getDb().prepare("UPDATE accounts SET member_since = NULL WHERE id = ?").run(accountId);
  return row?.stripe_subscription_id ?? null;
}

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
