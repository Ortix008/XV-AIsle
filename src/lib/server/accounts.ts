import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isAccountRole, type AccountRole } from "../account";
import { getDb } from "./db";
import { sendVerificationLink } from "./mail";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { authSecretReady, decryptSecret, encryptSecret, generateTotpSecret, verifyTotp } from "./totp";

const MONTH = 30 * 24 * 60 * 60 * 1000;

export type PublicAccount = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  memberSince: number | null;
  role: AccountRole;
  membershipStatus: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
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
  email_verified?: number | null;
  failed_logins?: number | null;
  locked_until?: number | null;
  totp_secret?: string | null;
  totp_enabled?: number | null;
};

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function roleFor(row: AccountRow): AccountRole {
  if (isAccountRole(row.role)) return row.role;
  getDb().prepare("UPDATE accounts SET role = 'buyer' WHERE id = ?").run(row.id);
  return "buyer";
}

/** Emails the seed script may promote. Empty means the script is not limited. Signup never reads this. */
export function adminAllowlist() {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return null;
  const emails = raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
  return new Set(emails);
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
    emailVerified: row.email_verified === 1,
    totpEnabled: row.totp_enabled === 1,
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
    role: "buyer",
    membership_status: null,
    email_verified: 0,
  };
  db.prepare(
    `INSERT INTO accounts (
       id, name, email, password_hash, password_salt, created_at, member_since, stripe_customer_id, stripe_subscription_id, role, email_verified
     ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'buyer', 0)`,
  ).run(
    account.id,
    account.name,
    account.email,
    account.password_hash,
    account.password_salt,
    account.created_at,
  );
  void sendAccountVerification(account.id).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Verification email failed.";
    console.error(message);
  });
  return { account: publicAccount(account), token: openSession(account.id) };
}

const VERIFY_MS = 24 * 60 * 60 * 1000;

let verificationChain: Promise<unknown> = Promise.resolve();

export function sendAccountVerification(accountId: string) {
  const run = verificationChain.then(() => issueVerification(accountId));
  verificationChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function issueVerification(accountId: string) {
  const row = getDb().prepare("SELECT id, email, email_verified FROM accounts WHERE id = ?").get(accountId) as
    | { id: string; email: string; email_verified: number | null }
    | undefined;
  if (!row) return { error: "That account is not on file." as const };
  if (row.email_verified === 1) return { already: true as const };
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + VERIFY_MS;
  getDb().prepare("DELETE FROM email_verifications WHERE account_id = ?").run(row.id);
  getDb()
    .prepare("INSERT INTO email_verifications (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash(token), row.id, expires);
  const origin = (process.env.APP_URL ?? "http://127.0.0.1:4317").replace(/\/$/, "");
  const link = `${origin}/api/account/verify?token=${token}`;
  await sendVerificationLink({ to: row.email, link });
  return { sent: true as const, token };
}

export function verifyEmailToken(token: string | null | undefined) {
  if (!token || token.length < 32 || token.length > 200) return { error: "That link is not valid." as const };
  const db = getDb();
  const row = db
    .prepare("SELECT account_id, expires_at FROM email_verifications WHERE token_hash = ?")
    .get(tokenHash(token)) as { account_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now()) return { error: "That link is not valid." as const };
  db.prepare("UPDATE accounts SET email_verified = 1 WHERE id = ?").run(row.account_id);
  db.prepare("DELETE FROM email_verifications WHERE account_id = ?").run(row.account_id);
  return { account: getAccount(row.account_id) };
}

/**
 * Creates a verified admin, or promotes an existing account matched by email.
 * Promotion sets role and email_verified only. Name, password, membership, and Stripe ids stay.
 * ADMIN_EMAILS, when set, is an allowlist for this function. Signup does not grant admin from it.
 */
export function seedAdmin(input: { name?: string; email: string; password?: string }) {
  const email = input.email.trim().toLowerCase();
  if (email.length > 120 || !email.includes("@") || !email.includes(".")) {
    return { error: "That email does not look right." as const };
  }
  const allowed = adminAllowlist();
  if (allowed && !allowed.has(email)) {
    return { error: "That email is not on the admin allowlist." as const };
  }
  const db = getDb();
  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email) as { id: string } | undefined;
  if (existing) {
    db.prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(existing.id);
    return { account: getAccount(existing.id)! };
  }
  const name = (input.name?.trim() || "Operator").slice(0, 80);
  const password = input.password ?? "";
  if (name.length < 2) return { error: "Add a name." as const };
  if (password.length < 8 || password.length > 200) {
    return { error: "Use a password of 8 to 200 characters." as const };
  }
  const { salt, hash } = hashPassword(password);
  const id = randomUUID();
  db.prepare(
    `INSERT INTO accounts (
       id, name, email, password_hash, password_salt, created_at, member_since, stripe_customer_id, stripe_subscription_id, role, email_verified
     ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'admin', 1)`,
  ).run(id, name, email, hash, salt, Date.now());
  return { account: getAccount(id)! };
}

const LOCK_MS = 15 * 60 * 1000;
const CHALLENGE_MS = 5 * 60 * 1000;

export function signIn(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  if (email.length > 120 || input.password.length > 200) {
    return { error: "That email and password do not match." as const };
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM accounts WHERE email = ?").get(email) as AccountRow | undefined;
  if (!row) {
    burnPasswordCheck(input.password);
    return { error: "That email and password do not match." as const };
  }
  const locked = (row.locked_until ?? 0) > Date.now();
  const passwordOk = verifyPassword(input.password, row.password_salt, row.password_hash);
  if (!passwordOk || locked) {
    if (!passwordOk && !locked) {
      const fails = (row.failed_logins ?? 0) + 1;
      const until = fails >= 5 ? Date.now() + LOCK_MS : null;
      db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = ? WHERE id = ?").run(fails, until, row.id);
    }
    return { error: "That email and password do not match." as const };
  }
  db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(row.id);
  if (row.totp_enabled === 1) {
    const challenge = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM login_challenges WHERE account_id = ?").run(row.id);
    db.prepare("INSERT INTO login_challenges (token_hash, account_id, expires_at) VALUES (?, ?, ?)").run(
      tokenHash(challenge),
      row.id,
      Date.now() + CHALLENGE_MS,
    );
    return { totpRequired: true as const, challenge };
  }
  return { account: publicAccount(row), token: openSession(row.id) };
}

export function finishTotpSignIn(challenge: string, code: string) {
  if (challenge.length < 32 || challenge.length > 200) {
    return { error: "That sign-in step expired. Enter your password again." as const };
  }
  const db = getDb();
  const row = db
    .prepare("SELECT account_id, expires_at FROM login_challenges WHERE token_hash = ?")
    .get(tokenHash(challenge)) as { account_id: string; expires_at: number } | undefined;
  if (!row || row.expires_at < Date.now()) {
    return { error: "That sign-in step expired. Enter your password again." as const };
  }
  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(row.account_id) as AccountRow | undefined;
  const secret = account?.totp_secret ? decryptSecret(account.totp_secret) : null;
  if (!account || account.totp_enabled !== 1 || !secret || !verifyTotp(secret, code)) {
    return { error: "That code did not match. Try the next code from your authenticator app." as const };
  }
  db.prepare("DELETE FROM login_challenges WHERE account_id = ?").run(account.id);
  return { account: publicAccount(account), token: openSession(account.id) };
}

export function startTotp(accountId: string) {
  if (!authSecretReady()) return { error: "Set AUTH_SECRET on the server before turning on an authenticator." as const };
  const row = getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as AccountRow | undefined;
  if (!row) return { error: "That account is not on file." as const };
  if (row.totp_enabled === 1) return { error: "An authenticator is already on for this account." as const };
  const secret = generateTotpSecret();
  const stored = encryptSecret(secret);
  if (!stored) return { error: "Set AUTH_SECRET on the server before turning on an authenticator." as const };
  getDb().prepare("UPDATE accounts SET totp_secret = ?, totp_enabled = 0 WHERE id = ?").run(stored, accountId);
  const label = encodeURIComponent(row.email);
  return {
    secret,
    uri: `otpauth://totp/XVAIsle:${label}?secret=${secret}&issuer=XVAIsle&algorithm=SHA1&digits=6&period=30`,
  };
}

export function confirmTotp(accountId: string, code: string) {
  const row = getDb().prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as AccountRow | undefined;
  if (!row?.totp_secret) return { error: "Start authenticator setup first." as const };
  if (row.totp_enabled === 1) return { account: publicAccount(row) };
  const secret = decryptSecret(row.totp_secret);
  if (!secret || !verifyTotp(secret, code)) {
    return { error: "That code did not match. Check the secret in your app and try the current code." as const };
  }
  getDb().prepare("UPDATE accounts SET totp_enabled = 1 WHERE id = ?").run(accountId);
  return { account: getAccount(accountId)! };
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
  if (row.role === "admin") {
    return { error: "The operator role is set on the server." as const };
  }
  getDb().prepare("UPDATE accounts SET role = ? WHERE id = ?").run(role, accountId);
  return { account: getAccount(accountId)! };
}

export function markMember(
  accountId: string,
  stripeCustomerId: string | null,
  stripeSubscriptionId: string | null,
  status: "active" | "trialing" = "active",
) {
  getDb()
    .prepare(
      `UPDATE accounts
       SET member_since = COALESCE(member_since, ?),
           stripe_customer_id = COALESCE(?, stripe_customer_id),
           stripe_subscription_id = COALESCE(?, stripe_subscription_id),
           membership_status = ?
       WHERE id = ?`,
    )
    .run(Date.now(), stripeCustomerId, stripeSubscriptionId, status, accountId);
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
