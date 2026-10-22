import { accountSupportRef } from "../src/lib/account";
import { publishDenial, type Actor } from "../src/lib/server/access";
import { RESELLER_COMMISSION_BPS, RESELLER_DISCLOSURE, resellerCommissionLabel } from "../src/lib/policies";

const reseller: Actor = {
  id: "reseller",
  role: "reseller",
  memberSince: null,
  membershipStatus: null,
  emailVerified: true,
  totpEnabled: false,
};

const open = publishDenial(reseller, true);
if (open !== null) throw new Error("publishing works without a membership");

const payout = publishDenial(reseller, false);
if (payout !== "Finish Stripe payout setup before publishing.") {
  throw new Error("payout setup is still required");
}
if (payout.toLowerCase().includes("membership")) throw new Error("publish denial should not mention membership");

const buyer = publishDenial({ ...reseller, role: "buyer" }, true);
if (buyer !== "Only a reseller can publish a listing.") throw new Error("a buyer still cannot publish");

if (RESELLER_COMMISSION_BPS !== 500) throw new Error("reseller commission is 5%");
if (resellerCommissionLabel() !== "5%") throw new Error("the reseller page reads the commission constant");
if (RESELLER_DISCLOSURE !== "#ad, I earn a commission.") throw new Error("the disclosure line changed");

const sampleId = "11111111-2222-3333-4444-555555a3f9c2";
if (accountSupportRef(sampleId) !== "Ref …a3f9c2") throw new Error("support ref uses the last 6 characters");
if (accountSupportRef(sampleId).includes("11111111")) throw new Error("support ref leaked the account id");

console.log("account checks ok", { commission: resellerCommissionLabel() });

async function checkPasswordReset() {
  process.env.DATABASE_PATH = ":memory:";
  const { signUp, requestPasswordReset, consumePasswordReset, signIn } = await import("../src/lib/server/accounts");
  const { COMMON_PASSWORD, PASSWORD_CHANGED_SUBJECT, PASSWORD_CHANGED_TEXT } = await import("../src/lib/signup-copy");
  const { startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { getDb } = await import("../src/lib/server/db");

  const created = signUp({ name: "Reset Buyer", email: "reset-buyer@example.com", password: "old-password" });
  if ("error" in created) throw new Error(created.error);
  const captured = startMailCapture();
  const logs: string[] = [];
  const original = console.info;
  console.info = (...args: unknown[]) => {
    logs.push(args.map((part) => String(part)).join(" "));
  };
  const asked = await requestPasswordReset("reset-buyer@example.com");
  const missing = await requestPasswordReset("nobody@example.com");
  console.info = original;
  stopMailCapture();
  if (!asked.ok || !missing.ok) throw new Error("a reset request always answers the same way");
  const resetMail = captured.filter((message) => message.subject === "Reset your XV-AIsle password");
  if (resetMail.length !== 1) throw new Error("password reset emails one link");
  const token = resetMail[0]?.text.match(/token=([a-f0-9]+)/)?.[1] ?? "";
  if (!resetMail[0]?.text.includes("/reset/confirm?token=") || token.length < 32) {
    throw new Error("password reset sends an email reset link");
  }
  if (logs.some((line) => line.includes(token))) throw new Error("the reset token is not logged");
  const stored = getDb().prepare("SELECT token_hash FROM password_resets").all() as { token_hash: string }[];
  if (stored.length !== 1 || stored[0]?.token_hash === token || stored[0]?.token_hash.length !== 64) {
    throw new Error("the reset token is stored as a hash");
  }
  const weak = consumePasswordReset(token, "short");
  if (!("error" in weak)) throw new Error("a short password is refused");
  const common = consumePasswordReset(token, "password");
  if (!("error" in common) || common.error !== COMMON_PASSWORD) throw new Error("a common password is refused");
  const titled = consumePasswordReset(token, "Password");
  if (!("error" in titled) || titled.error !== COMMON_PASSWORD) throw new Error("a common password ignores case");
  const still = getDb().prepare("SELECT COUNT(*) AS n FROM password_resets").get() as { n: number };
  if (still.n !== 1) throw new Error("a common password does not spend the reset link");
  const { POST: confirmReset } = await import("../src/app/api/account/reset/confirm/route");
  const confirmCommon = await confirmReset(
    new Request("http://127.0.0.1:4317/api/account/reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password: "password" }),
    }),
  );
  const confirmBody = (await confirmCommon.json()) as { error?: string };
  if (confirmCommon.status !== 400 || confirmBody.error !== COMMON_PASSWORD) {
    throw new Error("reset confirm refuses a common password");
  }
  const changedMail = startMailCapture();
  const saved = consumePasswordReset(token, "new-password");
  if ("error" in saved) throw new Error(saved.error);
  const note = changedMail.filter((message) => message.subject === PASSWORD_CHANGED_SUBJECT);
  if (note.length !== 1 || note[0]?.to !== "reset-buyer@example.com" || note[0]?.text !== PASSWORD_CHANGED_TEXT) {
    throw new Error("a password reset emails that the password changed");
  }
  stopMailCapture();
  const pendingMail = startMailCapture();
  const pending = signUp({ name: "Pending Reset", email: "pending-reset@example.com", password: "old-password" });
  if ("error" in pending) throw new Error(pending.error);
  const pendingAsked = await requestPasswordReset("pending-reset@example.com");
  if (!pendingAsked.ok) throw new Error("a pending reset request is accepted");
  const pendingToken =
    pendingMail.find((message) => message.to === "pending-reset@example.com" && message.subject === "Reset your XV-AIsle password")?.text.match(/token=([a-f0-9]+)/)?.[1] ?? "";
  stopMailCapture();
  if (pendingToken.length < 32) throw new Error("a receipt account receives a reset link");
  getDb().prepare("UPDATE accounts SET email = ? WHERE id = ?").run("x-9@pending.xvaisle.invalid", pending.account.id);
  const quiet = startMailCapture();
  const pendingSaved = consumePasswordReset(pendingToken, "another-password");
  stopMailCapture();
  if ("error" in pendingSaved) throw new Error(pendingSaved.error);
  if (quiet.some((message) => message.subject === PASSWORD_CHANGED_SUBJECT)) {
    throw new Error("a receipt placeholder does not get a password-changed email");
  }
  const reused = consumePasswordReset(token, "another-password");
  if (!("error" in reused)) throw new Error("a reset link works once");
  const signedIn = signIn({ email: "reset-buyer@example.com", password: "new-password" });
  if ("error" in signedIn) throw new Error("the new password signs in");
  const oldPassword = signIn({ email: "reset-buyer@example.com", password: "old-password" });
  if (!("error" in oldPassword)) throw new Error("the old password stops working");
  console.log("password reset emails a one-time link");
}

const MISMATCH = "That email and password do not match.";

function setNodeEnv(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value == null) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

function totpChallenge(result: object) {
  if (!("challenge" in result)) return null;
  const challenge = (result as { challenge?: unknown }).challenge;
  return typeof challenge === "string" ? challenge : null;
}

function errorText(result: object) {
  if (!("error" in result)) return null;
  const error = (result as { error?: unknown }).error;
  return typeof error === "string" ? error : null;
}

async function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  const route =
    path === "signin"
      ? await import("../src/app/api/account/signin/route")
      : path === "signup"
        ? await import("../src/app/api/account/signup/route")
        : await import("../src/app/api/account/reset/route");
  const response = await route.POST(
    new Request(`http://127.0.0.1:4317/api/account/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", ...headers },
      body: JSON.stringify(body),
    }),
  );
  const payload = (await response.json().catch(() => null)) as { error?: string; message?: string; account?: { id: string } } | null;
  return { status: response.status, body: payload, cookie: response.headers.get("set-cookie") };
}

async function checkSignInHardening() {
  delete process.env.TRUST_PROXY;
  process.env.AUTH_SECRET = "signin-hardening-test";
  const { getDb } = await import("../src/lib/server/db");
  const { signIn, signUp, startTotp, confirmTotp, finishTotpSignIn, requestPasswordReset } = await import(
    "../src/lib/server/accounts"
  );
  const { totpCode } = await import("../src/lib/server/totp");
  const { setMailDelivery, startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { COMMON_PASSWORD, SIGNUP_CHECK_EMAIL, SIGNUP_TAKEN_SUBJECT, SIGNUP_TAKEN_TEXT } = await import("../src/lib/signup-copy");
  const db = getDb();
  db.prepare("DELETE FROM rate_hits").run();

  const real = signUp({ name: "Rate Real", email: "rate-real@example.com", password: "old-password" });
  const other = signUp({ name: "Rate Other", email: "rate-other@example.com", password: "old-password" });
  if ("error" in real || "error" in other) throw new Error("rate accounts were not created");

  db.prepare("UPDATE accounts SET locked_until = ? WHERE email = ?").run(Date.now() + 15 * 60 * 1000, "rate-real@example.com");
  const despiteLock = signIn({ email: "rate-real@example.com", password: "old-password" });
  if (!("token" in despiteLock)) throw new Error("a stored lock does not block the right password");
  const lockedMiss = signIn({ email: "rate-real@example.com", password: "wrong-pass" });
  const unknownDirect = signIn({ email: "nobody-direct@example.com", password: "wrong-pass" });
  if (!("error" in lockedMiss) || !("error" in unknownDirect)) throw new Error("both misses fail");
  if (lockedMiss.error !== MISMATCH || unknownDirect.error !== MISMATCH) throw new Error("unknown and real misses share a message");
  if ("locked" in lockedMiss || "locked" in unknownDirect) throw new Error("a miss is not a hard lock");

  const unknownStarted = performance.now();
  const unknownHttp = await postJson("signin", { email: "nobody-http@example.com", password: "wrong-pass" });
  const unknownMs = performance.now() - unknownStarted;
  const knownStarted = performance.now();
  const knownHttp = await postJson("signin", { email: "rate-other@example.com", password: "wrong-pass" });
  const knownMs = performance.now() - knownStarted;
  if (unknownHttp.status !== knownHttp.status || unknownHttp.body?.error !== knownHttp.body?.error) {
    throw new Error("unknown and real sign-in share status and message");
  }
  if (unknownHttp.status !== 400 || unknownHttp.body?.error !== MISMATCH) throw new Error("a miss stays a mismatch");
  const slower = Math.max(unknownMs, knownMs);
  const faster = Math.max(1, Math.min(unknownMs, knownMs));
  if (faster < 5 || slower > faster * 4) throw new Error(`sign-in timing diverged (${unknownMs.toFixed(0)}ms vs ${knownMs.toFixed(0)}ms)`);

  const arrayPassword = await postJson("signin", { email: "rate-real@example.com", password: ["wrong-pass"] });
  if (arrayPassword.status !== 400 || arrayPassword.body?.error !== "Send an email and password.") {
    throw new Error("a non-string password is a 400");
  }
  const libraryPassword = signIn({ email: "rate-real@example.com", password: ["wrong-pass"] as unknown as string });
  if (!("error" in libraryPassword) || libraryPassword.error !== MISMATCH) {
    throw new Error("signIn refuses a non-string password");
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const miss = await postJson("signin", { email: "rate-real@example.com", password: "wrong-pass" }, { "x-forwarded-for": "198.51.100.4" });
    if (miss.status !== 400) throw new Error("misses before the account limit stay a mismatch");
  }
  const otherStill = await postJson("signin", { email: "rate-other@example.com", password: "wrong-pass" }, { "x-forwarded-for": "198.51.100.4" });
  if (otherStill.status !== 400) throw new Error("without TRUST_PROXY one account does not fill a shared bucket");
  const throttled = await postJson("signin", { email: "rate-real@example.com", password: "wrong-pass" }, { "x-forwarded-for": "203.0.113.77" });
  if (throttled.status !== 429) throw new Error("the per-account sign-in limit still throttles");
  const owner = await postJson("signin", { email: "rate-real@example.com", password: "old-password" }, { "x-forwarded-for": "203.0.113.77" });
  if (owner.status !== 200 || !owner.body?.account) throw new Error("the right password is not locked out");

  const commonNew = await postJson("signup", {
    name: "Common Person",
    email: "common-new@example.com",
    password: "password",
    confirmPassword: "password",
  });
  const commonExisting = await postJson("signup", {
    name: "Rate Real",
    email: "rate-real@example.com",
    password: "Password",
    confirmPassword: "Password",
  });
  if (commonNew.status !== 400 || commonExisting.status !== 400 || commonNew.body?.error !== COMMON_PASSWORD || commonExisting.body?.error !== COMMON_PASSWORD) {
    throw new Error("signup refuses a common password the same way for a new or existing email");
  }
  if (commonNew.body?.message || commonExisting.body?.message || db.prepare("SELECT id FROM accounts WHERE email = ?").get("common-new@example.com")) {
    throw new Error("a common password does not open an account or say to check email");
  }

  const captured = startMailCapture();
  const created = await postJson("signup", {
    name: "Fresh Person",
    email: "fresh-one@example.com",
    password: "old-password",
    confirmPassword: "old-password",
  });
  const again = await postJson("signup", {
    name: "Fresh Person",
    email: "fresh-one@example.com",
    password: "old-password",
    confirmPassword: "old-password",
  });
  if (created.status !== 200 || again.status !== 200) throw new Error("signup answers the same way for a new and existing email");
  if (created.body?.message !== SIGNUP_CHECK_EMAIL || again.body?.message !== SIGNUP_CHECK_EMAIL) {
    throw new Error("signup says to check email");
  }
  if (created.cookie || again.cookie || created.body?.account || again.body?.error) {
    throw new Error("signup does not reveal whether the email exists");
  }
  const takenMail = captured.filter((message) => message.subject === SIGNUP_TAKEN_SUBJECT);
  if (takenMail.length !== 1 || takenMail[0]?.to !== "fresh-one@example.com" || takenMail[0]?.text !== SIGNUP_TAKEN_TEXT) {
    throw new Error("an existing signup emails the owner");
  }
  for (let index = 0; index < 6; index += 1) {
    const distinct = await postJson("signup", {
      name: "Fresh Person",
      email: `fresh-many-${index}@example.com`,
      password: "old-password",
      confirmPassword: "old-password",
    });
    if (distinct.status !== 200) throw new Error("distinct signups do not share one bucket without TRUST_PROXY");
  }
  for (let extra = 0; extra < 3; extra += 1) {
    await postJson("signup", {
      name: "Fresh Person",
      email: "fresh-one@example.com",
      password: "old-password",
      confirmPassword: "old-password",
    });
  }
  const signupLimited = await postJson("signup", {
    name: "Fresh Person",
    email: "fresh-one@example.com",
    password: "old-password",
    confirmPassword: "old-password",
  });
  if (signupLimited.status !== 429) throw new Error("the per-account signup limit still throttles");
  const signupOther = await postJson("signup", {
    name: "Fresh Person",
    email: "fresh-still@example.com",
    password: "old-password",
    confirmPassword: "old-password",
  });
  if (signupOther.status !== 200) throw new Error("a signup limit on one email leaves another email open");
  stopMailCapture();

  const resetKnown = await postJson("reset", { email: "reset-buyer@example.com" });
  const resetMissing = await postJson("reset", { email: "missing-reset-http@example.com" });
  if (
    resetKnown.status !== 200 ||
    resetKnown.status !== resetMissing.status ||
    resetKnown.body?.message !== resetMissing.body?.message
  ) {
    throw new Error("unknown and real resets share status and message");
  }
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const reset = await postJson("reset", { email: "reset-buyer@example.com" });
    if (reset.status !== 200) throw new Error("reset stays open under the account limit");
  }
  const resetLimited = await postJson("reset", { email: "reset-buyer@example.com" });
  if (resetLimited.status !== 429) throw new Error("the per-account reset limit still throttles");
  const resetOther = await postJson("reset", { email: "reset-other@example.com" });
  if (resetOther.status !== 200) throw new Error("a reset limit on one email leaves another email open");
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  setMailDelivery(async () => {
    await gate;
  });
  const raced = await Promise.race([
    requestPasswordReset("reset-buyer@example.com").then(() => "done" as const),
    new Promise<"slow">((resolve) => setTimeout(() => resolve("slow"), 200)),
  ]);
  const missingStarted = performance.now();
  await requestPasswordReset("missing-reset@example.com");
  const missingMs = performance.now() - missingStarted;
  setMailDelivery(null);
  release();
  if (raced !== "done" || missingMs > 200) throw new Error("reset mail does not hold the response");

  const totpAccount = signUp({ name: "Totp Person", email: "totp-person@example.com", password: "old-password" });
  const totpOther = signUp({ name: "Totp Other", email: "totp-other@example.com", password: "old-password" });
  if ("error" in totpAccount || "error" in totpOther) {
    throw new Error("totp accounts were not created");
  }
  const started = startTotp(totpAccount.account.id);
  const otherStarted = startTotp(totpOther.account.id);
  if ("error" in started || "error" in otherStarted) throw new Error("totp setup failed");
  const enabled = confirmTotp(totpAccount.account.id, totpCode(started.secret));
  const otherEnabled = confirmTotp(totpOther.account.id, totpCode(otherStarted.secret));
  if ("error" in enabled || "error" in otherEnabled) throw new Error("totp confirm failed");
  const challenge = totpChallenge(signIn({ email: "totp-person@example.com", password: "old-password" }));
  if (!challenge) throw new Error("totp sign-in asks for a code");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const wrong = finishTotpSignIn(challenge, "000000");
    const wrongError = errorText(wrong);
    if (!wrongError?.includes("did not match")) throw new Error("a wrong code is refused");
    const left = db.prepare("SELECT COUNT(*) AS n FROM login_challenges WHERE account_id = ?").get(totpAccount.account.id) as {
      n: number;
    };
    if (left.n !== 1) throw new Error("the challenge stays until the fifth miss");
  }
  const fifth = finishTotpSignIn(challenge, "000000");
  if (!errorText(fifth)) throw new Error("the fifth code is refused");
  const gone = db.prepare("SELECT COUNT(*) AS n FROM login_challenges WHERE account_id = ?").get(totpAccount.account.id) as {
    n: number;
  };
  if (gone.n !== 0) throw new Error("five wrong codes delete the challenge");
  const expired = finishTotpSignIn(challenge, totpCode(started.secret));
  const expiredError = errorText(expired);
  if (!expiredError?.includes("expired")) throw new Error("a deleted challenge cannot be reused");

  db.prepare("DELETE FROM rate_hits").run();
  const at = Date.now();
  const code = totpCode(started.secret, at + 30_000);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const next = totpChallenge(signIn({ email: "totp-person@example.com", password: "old-password" }));
    if (!next) throw new Error("totp still asks for a code");
    const miss = await postJson("signin", { challenge: next, code: "000000" });
    if (miss.status !== 400) throw new Error("totp misses before the account limit stay a mismatch");
  }
  const totpBlocked = totpChallenge(signIn({ email: "totp-person@example.com", password: "old-password" }));
  if (!totpBlocked) throw new Error("totp challenge was not issued");
  const totpLimited = await postJson("signin", { challenge: totpBlocked, code: "000000" });
  if (totpLimited.status !== 429) throw new Error("the per-account totp limit still throttles");
  const otherChallenge = totpChallenge(signIn({ email: "totp-other@example.com", password: "old-password" }));
  if (!otherChallenge) throw new Error("another account still reaches totp");
  const otherCode = await postJson("signin", { challenge: otherChallenge, code: "000000" });
  if (otherCode.status !== 400) throw new Error("one totp account does not throttle another");
  const fresh = totpChallenge(signIn({ email: "totp-person@example.com", password: "old-password" }));
  if (!fresh) throw new Error("the owner can still start totp");
  const accepted = await postJson("signin", { challenge: fresh, code });
  if (accepted.status !== 200 || !accepted.body?.account) throw new Error("a current code still signs in after throttling");
  const replayLogin = totpChallenge(signIn({ email: "totp-person@example.com", password: "old-password" }));
  if (!replayLogin) throw new Error("replay sign-in asks for a code");
  const replay = finishTotpSignIn(replayLogin, code);
  if (!("error" in replay)) throw new Error("a used authenticator code cannot be replayed");
  const storedStep = db.prepare("SELECT totp_last_step FROM accounts WHERE id = ?").get(totpAccount.account.id) as {
    totp_last_step: number | null;
  };
  if (storedStep.totp_last_step == null) throw new Error("the accepted time step is stored");

  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppUrl = process.env.APP_URL;
  setNodeEnv("production");
  process.env.APP_URL = "https://xvaisle.com";
  const { proxy } = await import("../src/proxy");
  const { NextRequest } = await import("next/server");
  const blocked = proxy(
    new NextRequest("https://xvaisle.com/api/account/signin", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    }),
  );
  if (blocked.status !== 403) throw new Error("a foreign Origin is refused");
  const referred = proxy(
    new NextRequest("https://xvaisle.com/api/account/signin", {
      method: "POST",
      headers: { referer: "https://evil.example/sign-in" },
    }),
  );
  if (referred.status !== 403) throw new Error("a foreign Referer is refused");
  const missing = proxy(new NextRequest("https://xvaisle.com/api/account/signin", { method: "POST" }));
  if (missing.status !== 403) throw new Error("a POST without Origin or Referer is refused");
  const allowed = proxy(
    new NextRequest("https://xvaisle.com/api/account/signin", {
      method: "POST",
      headers: { origin: "https://xvaisle.com" },
    }),
  );
  if (allowed.status === 403) throw new Error("the app Origin is allowed");
  const fromReferer = proxy(
    new NextRequest("https://xvaisle.com/api/store/checkout", {
      method: "POST",
      headers: { referer: "https://xvaisle.com/shop/sheet-pan" },
    }),
  );
  if (fromReferer.status === 403) throw new Error("Referer can stand in for a missing Origin");
  const webhook = proxy(new NextRequest("https://xvaisle.com/api/billing/webhook", { method: "POST" }));
  if (webhook.status === 403) throw new Error("the Stripe webhook stays open");
  const hsts = allowed.headers.get("strict-transport-security") ?? "";
  if (!hsts.includes("max-age=")) throw new Error("production adds HSTS");
  const resetConfirm = proxy(new NextRequest("https://xvaisle.com/reset/confirm?token=abc", { method: "GET" }));
  if (resetConfirm.headers.get("referrer-policy") !== "no-referrer") {
    throw new Error("reset confirm sends Referrer-Policy no-referrer");
  }
  const resetPage = proxy(new NextRequest("https://xvaisle.com/reset", { method: "GET" }));
  if (resetPage.headers.get("referrer-policy") !== "no-referrer") {
    throw new Error("the reset page sends Referrer-Policy no-referrer");
  }
  if (allowed.headers.get("referrer-policy") === "no-referrer") {
    throw new Error("sign-in does not send Referrer-Policy no-referrer");
  }
  setNodeEnv("development");
  const dev = proxy(new NextRequest("http://127.0.0.1:4317/", { method: "GET" }));
  if (dev.headers.get("strict-transport-security")) throw new Error("development does not add HSTS");
  setNodeEnv(previousNodeEnv);
  if (previousAppUrl == null) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;

  console.log("sign-in hardening checks ok");
}

checkPasswordReset()
  .then(() => checkSignInHardening())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
