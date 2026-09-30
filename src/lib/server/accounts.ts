import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isAccountRole, type AccountRole } from "../account";
import { getDb } from "./db";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";

const MONTH = 30 * 24 * 60 * 60 * 1000;

export type PublicAccount = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  memberSince: number | null;
  role: AccountRole;
  membershipStatus: string | null;
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
  role?: string | null;
  membership_status?: string | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function adminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
}

function roleFor(row: AccountRow): AccountRole {
  const admin = adminEmail();
  if (admin && row.email === admin) {
    if (row.role !== "admin") getDb().prepare("UPDATE accounts SET role = 'admin' WHERE id = ?").run(row.id);
    return "admin";
  }
  if (row.role === "admin" || !isAccountRole(row.role)) {
    getDb().prepare("UPDATE accounts SET role = 'buyer' WHERE id = ?").run(row.id);
    return "buyer";
  }
  return row.role;
}

function publicAccount(row: AccountRow): PublicAccount {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    createdAt: row.created_at,
    memberSince: row.member_since,
    role: roleFor(row),
    membershipStatus: row.membership_status ?? null,
  };
}

function initialRole(email: string): AccountRole {
  return adminEmail() && email === adminEmail() ? "admin" : "buyer";
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
    role: initialRole(email),
    membership_status: null,
  };
  db.prepare(
    `INSERT INTO accounts (
       id, name, email, password_hash, password_salt, created_at, member_since, stripe_customer_id, stripe_subscription_id, role
     ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)`,
  ).run(
    account.id,
    account.name,
    account.email,
    account.password_hash,
    account.password_salt,
    account.created_at,
    account.role,
  );
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

export function getAccount(accountId: string) {
  const row = getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as AccountRow | undefined;
  return row ? publicAccount(row) : null;
}

export function setOwnRole(accountId: string, role: "reseller" | "supplier") {
  const row = getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as AccountRow | undefined;
  if (!row) return { error: "That account is not on file." as const };
  if (adminEmail() && row.email === adminEmail()) {
    return { error: "The operator role comes from the server configuration." as const };
  }
  getDb().prepare("UPDATE accounts SET role = ? WHERE id = ?").run(role, accountId);
  return { account: getAccount(accountId)! };
}

export function markMember(accountId: string, stripeCustomerId: string | null, stripeSubscriptionId: string | null) {
  getDb()
    .prepare(
      `UPDATE accounts
       SET member_since = COALESCE(member_since, ?),
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           stripe_subscription_id = COALESCE(?, stripe_subscription_id),
           membership_status = 'active'
       WHERE id = ?`,
    )
    .run(Date.now(), stripeCustomerId, stripeSubscriptionId, accountId);
}

export function setMembershipInactive(
  accountId: string,
  status: "past_due" | "canceled",
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
) {
  getDb()
    .prepare(
      `UPDATE accounts
       SET member_since = NULL,
           membership_status = ?,
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           stripe_subscription_id = COALESCE(?, stripe_subscription_id)
       WHERE id = ?`,
    )
    .run(status, stripeCustomerId, stripeSubscriptionId, accountId);
}

export function clearMembership(accountId: string) {
  const row = getDb()
    .prepare("SELECT stripe_subscription_id FROM accounts WHERE id = ?")
    .get(accountId) as { stripe_subscription_id: string | null } | undefined;
  getDb().prepare("UPDATE accounts SET member_since = NULL, membership_status = 'canceled' WHERE id = ?").run(accountId);
  return row?.stripe_subscription_id ?? null;
}

export function accountIdByStripe(ids: { customerId?: string | null; subscriptionId?: string | null }) {
  const db = getDb();
  if (ids.subscriptionId) {
    const row = db.prepare("SELECT id FROM accounts WHERE stripe_subscription_id = ?").get(ids.subscriptionId) as
      | { id: string }
      | undefined;
    if (row) return row.id;
  }
  if (ids.customerId) {
    const row = db.prepare("SELECT id FROM accounts WHERE stripe_customer_id = ?").get(ids.customerId) as
      | { id: string }
      | undefined;
    if (row) return row.id;
  }
  return null;
}

export function billingConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
