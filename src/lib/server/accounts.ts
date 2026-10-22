import { createHash, randomBytes, randomUUID } from "node:crypto";
import { isAccountRole, type AccountRole } from "../account";
import { isCommonPassword } from "../common-passwords";
import { COMMON_PASSWORD, PASSWORD_CHANGED_SUBJECT, passwordChangedText } from "../signup-copy";
import { changed, getDb } from "./db";
import { logBackgroundMailError, sendMail, sendVerificationLink } from "./mail";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";
import { acceptedTotpStep, authSecretReady, decryptSecret, encryptSecret, generateTotpSecret } from "./totp";

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
  needsEmail: boolean;
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
  totp_last_step?: number | null;
  x_user_id?: string | null;
};

const PENDING_EMAIL_SUFFIX = "@pending.xvaisle.invalid";

function pendingReceiptEmail(email: string) {
  return email.endsWith(PENDING_EMAIL_SUFFIX);
}

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
  const needsEmail = pendingReceiptEmail(row.email);
  return {
    id: row.id,
    name: row.name,
    email: needsEmail ? "" : row.email,
    createdAt: row.created_at,
    memberSince: row.member_since,
    role: roleFor(row),
    membershipStatus: row.membership_status ?? null,
    emailVerified: row.email_verified === 1,
    totpEnabled: row.totp_enabled === 1,
    needsEmail,
  };
}

export function signUp(input: { name: string; email: string; password: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (name.length < 2 || name.length > 80) return { error: "Add your name." as const };
  if (email.length > 120 || !email.includes("@") || !email.includes(".") || pendingReceiptEmail(email)) {
    return { error: "That email does not look right." as const };
  }
  if (input.password.length < 8) return { error: "Use at least 8 characters." as const };
  if (input.password.length > 200) return { error: "Use a shorter password." as const };
  if (isCommonPassword(input.password)) return { error: COMMON_PASSWORD };
  const db = getDb();
  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email) as { id: string } | undefined;
  if (existing) {
    hashPassword(input.password);
    return { error: "That email already has an account. Sign in instead." as const, email };
  }
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
  if (pendingReceiptEmail(row.email)) return { error: "Add an email for receipts first." as const };
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

const RESET_MS = 60 * 60 * 1000;

function resetOrigin() {
  return (process.env.APP_URL ?? "http://127.0.0.1:4317").replace(/\/$/, "");
}

/** Always resolves the same way, whether or not that email has an account. */
export async function requestPasswordReset(email: string) {
  const normalized = email.trim().toLowerCase();
  if (normalized.length > 120 || !normalized.includes("@") || !normalized.includes(".") || pendingReceiptEmail(normalized)) {
    return { ok: true as const };
  }
  const row = getDb().prepare("SELECT id, email FROM accounts WHERE email = ?").get(normalized) as
    | { id: string; email: string }
    | undefined;
  if (!row || pendingReceiptEmail(row.email)) return { ok: true as const };
  const token = randomBytes(32).toString("hex");
  const expires = Date.now() + RESET_MS;
  const db = getDb();
  db.prepare("DELETE FROM password_resets WHERE account_id = ?").run(row.id);
  db.prepare("INSERT INTO password_resets (token_hash, account_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash(token),
    row.id,
    expires,
  );
  const link = `${resetOrigin()}/reset/confirm?token=${token}`;
  // Mail goes out in the background so a missing account is not slower or faster.
  void sendMail({
    to: row.email,
    subject: "Reset your XV-AIsle password",
    text: `Choose a new password:\n${link}\n\nThis link works once and then expires. If you didn't ask for it, you can ignore this email.\n`,
  }).catch(logBackgroundMailError);
  return { ok: true as const };
}

export function consumePasswordReset(token: string, password: string) {
  if (!token || token.length < 32 || token.length > 200) return { error: "That link is not valid." as const };
  if (password.length < 8) return { error: "Use at least 8 characters." as const };
  if (password.length > 200) return { error: "Use a shorter password." as const };
  if (isCommonPassword(password)) return { error: COMMON_PASSWORD };
  const db = getDb();
  const row = db.prepare("SELECT account_id, expires_at FROM password_resets WHERE token_hash = ?").get(tokenHash(token)) as
    | { account_id: string; expires_at: number }
    | undefined;
  if (!row || row.expires_at < Date.now()) {
    if (row) db.prepare("DELETE FROM password_resets WHERE token_hash = ?").run(tokenHash(token));
    return { error: "That link is not valid." as const };
  }
  const { salt, hash } = hashPassword(password);
  db.prepare(
    "UPDATE accounts SET password_hash = ?, password_salt = ?, failed_logins = 0, locked_until = NULL WHERE id = ?",
  ).run(hash, salt, row.account_id);
  const owner = db.prepare("SELECT email FROM accounts WHERE id = ?").get(row.account_id) as { email: string } | undefined;
  db.prepare("DELETE FROM password_resets WHERE account_id = ?").run(row.account_id);
  db.prepare("DELETE FROM sessions WHERE account_id = ?").run(row.account_id);
  if (owner && !pendingReceiptEmail(owner.email)) {
    void sendMail({
      to: owner.email,
      subject: PASSWORD_CHANGED_SUBJECT,
      text: passwordChangedText(),
    }).catch(logBackgroundMailError);
  }
  return { ok: true as const };
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

const CHALLENGE_MS = 5 * 60 * 1000;

export function signIn(input: { email: string; password: string }) {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    return { error: "That email and password do not match." as const };
  }
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
  // Misses are throttled per account at the route. A correct password still signs in,
  // so an attacker cannot lock the owner out.
  const passwordOk = verifyPassword(input.password, row.password_salt, row.password_hash);
  if (!passwordOk) {
    const fails = (row.failed_logins ?? 0) + 1;
    db.prepare("UPDATE accounts SET failed_logins = ?, locked_until = NULL WHERE id = ?").run(fails, row.id);
    return { error: "That email and password do not match." as const };
  }
  db.prepare("UPDATE accounts SET failed_logins = 0, locked_until = NULL WHERE id = ?").run(row.id);
  if (row.totp_enabled === 1) {
    return { totpRequired: true as const, challenge: issueTotpChallenge(row.id) };
  }
  return { account: publicAccount(row), token: openSession(row.id) };
}

function issueTotpChallenge(accountId: string) {
  const challenge = randomBytes(32).toString("hex");
  const db = getDb();
  db.prepare("DELETE FROM login_challenges WHERE account_id = ?").run(accountId);
  db.prepare("INSERT INTO login_challenges (token_hash, account_id, expires_at) VALUES (?, ?, ?)").run(
    tokenHash(challenge),
    accountId,
    Date.now() + CHALLENGE_MS,
  );
  return challenge;
}

function xDisplayName(value: string) {
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 80);
  if (cleaned.length < 2) return "Member";
  return cleaned;
}

function insertXAccount(input: { xUserId: string; name: string }) {
  const db = getDb();
  const name = xDisplayName(input.name);
  const email = `x-${input.xUserId}${PENDING_EMAIL_SUFFIX}`;
  const { salt, hash } = hashPassword(randomBytes(24).toString("base64url"));
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO accounts (
         id, name, email, password_hash, password_salt, created_at, member_since, stripe_customer_id, stripe_subscription_id, role, email_verified, x_user_id
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'buyer', 0, ?)`,
    ).run(id, name, email, hash, salt, Date.now(), input.xUserId);
  } catch {
    return db.prepare("SELECT * FROM accounts WHERE x_user_id = ?").get(input.xUserId) as AccountRow | undefined;
  }
  return db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined;
}

export function signInWithX(input: { xUserId: string; name: string }) {
  if (!/^\d{1,32}$/.test(input.xUserId)) return { error: "X did not return an account id." as const };
  const existing = getDb().prepare("SELECT * FROM accounts WHERE x_user_id = ?").get(input.xUserId) as AccountRow | undefined;
  const row = existing ?? insertXAccount(input);
  if (!row) return { error: "X sign-in did not finish." as const };
  if (row.totp_enabled === 1) {
    return { totpRequired: true as const, challenge: issueTotpChallenge(row.id) };
  }
  return { account: publicAccount(row), token: openSession(row.id) };
}

export function setReceiptEmail(accountId: string, email: string) {
  const next = email.trim().toLowerCase();
  if (next.length > 120 || !next.includes("@") || !next.includes(".") || pendingReceiptEmail(next)) {
    return { error: "That email does not look right." as const };
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(accountId) as AccountRow | undefined;
  if (!row) return { error: "That account is not on file." as const };
  if (!pendingReceiptEmail(row.email)) return { error: "This account already has an email." as const };
  const taken = db.prepare("SELECT id FROM accounts WHERE email = ? AND id != ?").get(next, accountId) as
    | { id: string }
    | undefined;
  if (taken) return { error: "That email already has an account. Sign in instead." as const };
  try {
    const result = db
      .prepare("UPDATE accounts SET email = ?, email_verified = 0 WHERE id = ? AND email = ?")
      .run(next, accountId, row.email);
    if (changed(result) !== 1) return { error: "This account already has an email." as const };
  } catch {
    return { error: "That email already has an account. Sign in instead." as const };
  }
  void sendAccountVerification(accountId).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Verification email failed.";
    console.error(message);
  });
  return { account: getAccount(accountId)! };
}

export function finishTotpSignIn(challenge: string, code: string) {
  if (challenge.length < 32 || challenge.length > 200) {
    return { error: "That sign-in step expired. Enter your password again." as const };
  }
  const db = getDb();
  const row = db
    .prepare("SELECT account_id, expires_at, fails FROM login_challenges WHERE token_hash = ?")
    .get(tokenHash(challenge)) as { account_id: string; expires_at: number; fails: number | null } | undefined;
  if (!row || row.expires_at < Date.now()) {
    return { error: "That sign-in step expired. Enter your password again." as const };
  }
  const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(row.account_id) as AccountRow | undefined;
  const secret = account?.totp_secret ? decryptSecret(account.totp_secret) : null;
  const step = secret ? acceptedTotpStep(secret, code) : null;
  const last = account?.totp_last_step;
  const replay = step !== null && last != null && step <= last;
  if (!account || account.totp_enabled !== 1 || !secret || step === null || replay) {
    const fails = (row.fails ?? 0) + 1;
    if (fails >= 5) db.prepare("DELETE FROM login_challenges WHERE account_id = ?").run(row.account_id);
    else db.prepare("UPDATE login_challenges SET fails = ? WHERE token_hash = ?").run(fails, tokenHash(challenge));
    return {
      error: "That code did not match. Try the next code from your authenticator app." as const,
      accountId: row.account_id,
    };
  }
  db.prepare("UPDATE accounts SET totp_last_step = ? WHERE id = ?").run(step, account.id);
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
  const label = encodeURIComponent(pendingReceiptEmail(row.email) ? row.name : row.email);
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
  const step = secret ? acceptedTotpStep(secret, code) : null;
  const last = row.totp_last_step;
  if (!secret || step === null || (last != null && step <= last)) {
    return { error: "That code did not match. Check the secret in your app and try the current code." as const };
  }
  getDb().prepare("UPDATE accounts SET totp_enabled = 1, totp_last_step = ? WHERE id = ?").run(step, accountId);
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
