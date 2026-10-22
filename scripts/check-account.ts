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
  process.env.SUPPORT_EMAIL = "support@example.test";
  const { signUp, requestPasswordReset, consumePasswordReset, signIn } = await import("../src/lib/server/accounts");
  const { COMMON_PASSWORD, PASSWORD_CHANGED_SUBJECT, SIGNIN_400, SIGNUP_CHECK_EMAIL, SIGNUP_TAKEN_SUBJECT, passwordChangedText, signupTakenText } =
    await import("../src/lib/signup-copy");
  if (SIGNUP_CHECK_EMAIL !== "Check your email. We sent you a message with the next step.") {
    throw new Error("signup check-email copy");
  }
  if (SIGNUP_TAKEN_SUBJECT !== "Someone tried to sign up with your email") throw new Error("taken subject copy");
  if (
    signupTakenText() !==
    "Someone just tried to create an XV-AIsle account with this email address. You already have an account, so nothing changed. If it was you, sign in or reset your password. If it wasn't you, you can ignore this email. Questions? Email us at support@example.test."
  ) {
    throw new Error("taken email copy");
  }
  if (COMMON_PASSWORD !== "That password is easy to guess. Please choose a different one.") throw new Error("common password copy");
  if (PASSWORD_CHANGED_SUBJECT !== "Your XV-AIsle password was changed") throw new Error("password changed subject");
  if (
    passwordChangedText() !==
    "Your XV-AIsle password was just changed. If you did this, you're all set. If you didn't, reset your password and email us at support@example.test so we can help."
  ) {
    throw new Error("password changed email copy");
  }
  if (SIGNIN_400 !== "Enter your email and password.") throw new Error("signin 400 copy");
  process.env.SUPPORT_EMAIL = "  support@example.test  ";
  if (!passwordChangedText().endsWith("support@example.test so we can help.")) {
    throw new Error("SUPPORT_EMAIL is trimmed when the email is written");
  }
  process.env.SUPPORT_EMAIL = "support@example.test";
  const { logBackgroundMailError, setMailDelivery, startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
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
  if (
    note.length !== 1 ||
    note[0]?.to !== "reset-buyer@example.com" ||
    note[0]?.subject !== "Your XV-AIsle password was changed" ||
    note[0]?.text !==
      "Your XV-AIsle password was just changed. If you did this, you're all set. If you didn't, reset your password and email us at support@example.test so we can help."
  ) {
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

  const resetCapture = startMailCapture();
  const askedAgain = await requestPasswordReset("reset-buyer@example.com");
  const laterToken =
    resetCapture.find((message) => message.subject === "Reset your XV-AIsle password")?.text.match(/token=([a-f0-9]+)/)?.[1] ?? "";
  stopMailCapture();
  if (!askedAgain.ok || laterToken.length < 32) throw new Error("a later reset still emails a link");
  const poison = "leak-buyer@example.com token=deadbeefcafebabe https://xvaisle.com/reset/confirm?token=deadbeefcafebabe";
  const mailErrors: string[] = [];
  const writeMailError = console.error;
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown) => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", onRejection);
  console.error = (...args: unknown[]) => {
    mailErrors.push(args.map((part) => String(part)).join(" "));
  };
  try {
    logBackgroundMailError(new Error(poison));
    setMailDelivery(async () => {
      throw new Error(poison);
    });
    const changed = consumePasswordReset(laterToken, "third-password");
    if ("error" in changed) throw new Error(changed.error);
    await requestPasswordReset("reset-buyer@example.com");
    const { POST: signupPost } = await import("../src/app/api/account/signup/route");
    const taken = await signupPost(
      new Request("http://127.0.0.1:4317/api/account/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Reset Buyer",
          email: "reset-buyer@example.com",
          password: "old-password",
          confirmPassword: "old-password",
        }),
      }),
    );
    if (taken.status !== 200) throw new Error("a taken signup still answers 200 when mail fails");
    await new Promise((resolve) => setTimeout(resolve, 20));
  } finally {
    console.error = writeMailError;
    setMailDelivery(null);
    process.off("unhandledRejection", onRejection);
  }
  if (rejections.length !== 0) throw new Error("background mail is caught");
  const mailLog = mailErrors.join("\n");
  if (!mailLog.includes("Mail was not sent.")) throw new Error("background mail logs that it failed");
  if (mailLog.includes("@") || mailLog.includes(laterToken) || mailLog.includes("deadbeef") || mailLog.includes("reset/confirm")) {
    throw new Error("background mail logs omit the address and the token");
  }
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
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    message?: string;
    notice?: boolean;
    account?: { id: string };
  } | null;
  return { status: response.status, body: payload, cookie: response.headers.get("set-cookie") };
}

const LOCKOUT = "Too many tries. Wait a few minutes and try again.";

async function checkSignInHardening() {
  delete process.env.TRUST_PROXY;
  process.env.SUPPORT_EMAIL = "support@example.test";
  process.env.AUTH_SECRET = "signin-hardening-test";
  const { getDb } = await import("../src/lib/server/db");
  const { signIn, signUp, startTotp, confirmTotp, finishTotpSignIn, requestPasswordReset } = await import(
    "../src/lib/server/accounts"
  );
  const { totpCode } = await import("../src/lib/server/totp");
  const { setMailDelivery, startMailCapture, stopMailCapture } = await import("../src/lib/server/mail");
  const { COMMON_PASSWORD, SIGNUP_CHECK_EMAIL, SIGNUP_TAKEN_SUBJECT, signupTakenText } = await import("../src/lib/signup-copy");
  const db = getDb();
  db.prepare("DELETE FROM rate_hits").run();
  const { allowAttempt, sweepRateHits, RATE_LIMIT_WINDOW_MS } = await import("../src/lib/server/rate-limit");
  sweepRateHits(Date.now() - 61_000);
  const staleAt = Date.now() - RATE_LIMIT_WINDOW_MS - 1_000;
  db.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run("aged:foreign", staleAt);
  db.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run("fresh:foreign", Date.now());
  if (!allowAttempt("sweep:writer", 5, 1_000)) throw new Error("a sweep write should be allowed");
  const aged = db.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ?").get("aged:foreign") as { n: number | bigint };
  const freshHits = db.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ?").get("fresh:foreign") as { n: number | bigint };
  if (Number(aged.n) !== 0) throw new Error("rate hits older than the longest window are swept");
  if (Number(freshHits.n) !== 1) throw new Error("a fresh rate hit survives the sweep");
  db.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run("aged:later", staleAt);
  if (!allowAttempt("sweep:writer", 5, 1_000)) throw new Error("a second sweep write should be allowed");
  const later = db.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ?").get("aged:later") as { n: number | bigint };
  if (Number(later.n) !== 1) throw new Error("the rate sweep does not run on every write");

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
  if (arrayPassword.status !== 400 || arrayPassword.body?.error !== "Enter your email and password.") {
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
  if (throttled.status !== 429 || throttled.body?.error !== LOCKOUT || throttled.cookie) {
    throw new Error("the per-account sign-in limit still throttles");
  }
  const owner = await postJson("signin", { email: "rate-real@example.com", password: "old-password" }, { "x-forwarded-for": "203.0.113.77" });
  if (owner.status !== 429 || owner.body?.error !== LOCKOUT || owner.cookie || owner.body?.account) {
    throw new Error("the right password is locked out with the same reply");
  }

  const lockEmail = "lock-buyer@example.com";
  const lockPassword = "old-password";
  const lockedAccount = signUp({ name: "Lock Buyer", email: lockEmail, password: lockPassword });
  if ("error" in lockedAccount) throw new Error(lockedAccount.error);
  let fortieth: { status: number; body: { error?: string } | null; cookie: string | null } | null = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const miss = await postJson("signin", { email: lockEmail, password: "wrong-pass" }, { "x-forwarded-for": "198.51.100.40" });
    if (attempt < 8) {
      if (miss.status !== 400) throw new Error("the first eight wrong passwords stay a mismatch");
    } else if (miss.status !== 429 || miss.body?.error !== LOCKOUT || miss.cookie) {
      throw new Error("later wrong passwords are the lockout reply");
    }
    fortieth = miss;
  }
  const stillLocked = await postJson("signin", { email: lockEmail, password: lockPassword }, { "x-forwarded-for": "198.51.100.41" });
  if (
    stillLocked.status !== 429 ||
    stillLocked.body?.error !== fortieth?.body?.error ||
    stillLocked.body?.error !== LOCKOUT ||
    stillLocked.cookie ||
    stillLocked.body?.account
  ) {
    throw new Error("forty wrong passwords then the correct one gets no session");
  }

  process.env.TRUST_PROXY = "1";
  try {
    const lockedIp = "203.0.113.40";
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const miss = await postJson(
        "signin",
        { email: `ip-miss-${attempt}@example.com`, password: "wrong-pass" },
        { "x-forwarded-for": lockedIp },
      );
      if (miss.status !== 400) throw new Error("an IP bucket fills on misses");
    }
    const fromSameIp = await postJson(
      "signin",
      { email: "rate-other@example.com", password: "old-password" },
      { "x-forwarded-for": lockedIp },
    );
    if (fromSameIp.status !== 429 || fromSameIp.body?.error !== LOCKOUT || fromSameIp.cookie || fromSameIp.body?.account) {
      throw new Error("a full IP bucket refuses the correct password");
    }
    const fromOtherIp = await postJson(
      "signin",
      { email: "rate-other@example.com", password: "old-password" },
      { "x-forwarded-for": "203.0.113.41" },
    );
    if (fromOtherIp.status !== 200 || !fromOtherIp.cookie || !fromOtherIp.body?.account) {
      throw new Error("another IP can still sign in when only the first IP is locked");
    }
  } finally {
    delete process.env.TRUST_PROXY;
  }

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
  if (commonNew.body?.notice === true || commonExisting.body?.notice === true) {
    throw new Error("a signup error is not a notice");
  }
  const numberEmail = await postJson("signup", {
    name: "Typed Person",
    email: 1,
    password: "old-password",
    confirmPassword: "old-password",
  });
  const objectPassword = await postJson("signup", {
    name: "Typed Person",
    email: "typed-password@example.com",
    password: { secret: true },
    confirmPassword: "old-password",
  });
  if (numberEmail.status !== 400 || objectPassword.status !== 400) {
    throw new Error("a non-string email or password is a 400");
  }
  if (db.prepare("SELECT id FROM accounts WHERE email = ?").get("typed-password@example.com")) {
    throw new Error("a non-string password does not open an account");
  }
  const { signupFeedbackState } = await import("../src/lib/signup-feedback");
  const { readFileSync } = await import("node:fs");
  const noticed = signupFeedbackState({ kind: "notice", message: "Check your email." });
  if (noticed.notice !== "Check your email." || noticed.error !== null) {
    throw new Error("a notice flag is a notice without looking at the copy");
  }
  const prefixed = signupFeedbackState({ kind: "error", message: COMMON_PASSWORD });
  if (prefixed.error !== COMMON_PASSWORD || prefixed.notice !== null) {
    throw new Error("an error flag stays an error");
  }
  const screen = readFileSync(new URL("../src/components/auth-screens.tsx", import.meta.url), "utf8");
  const signupScreen = screen.slice(
    screen.indexOf("export function SignUpScreen"),
    screen.indexOf("export function ResetRequestScreen"),
  );
  if (signupScreen.includes("TODO(Wordy)") || signupScreen.includes("startsWith") || !signupScreen.includes("signupFeedbackState")) {
    throw new Error("the signup screen uses the notice flag");
  }
  if (commonNew.body?.message || commonExisting.body?.message || db.prepare("SELECT id FROM accounts WHERE email = ?").get("common-new@example.com")) {
    throw new Error("a common password does not open an account or say to check email");
  }
  const { isCommonPassword } = await import("../src/lib/common-passwords");
  for (const weak of ["Password123!", "aaaaaaaa", "xvaisle1", "Summer2026"]) {
    if (!isCommonPassword(weak)) throw new Error(`${weak} is still treated as strong`);
    const slug = weak.toLowerCase().replace(/[^a-z0-9]/g, "");
    const email = `weak-${slug}@example.com`;
    const refused = await postJson("signup", {
      name: "Weak Person",
      email,
      password: weak,
      confirmPassword: weak,
    });
    if (refused.status !== 400 || refused.body?.error !== COMMON_PASSWORD || refused.cookie || refused.body?.account) {
      throw new Error(`${weak} is still accepted`);
    }
    const strong = `shelf-maple-${slug.length}-ok`;
    if (isCommonPassword(strong)) throw new Error("the follow-up password is weak");
    const stronger = await postJson("signup", {
      name: "Weak Person",
      email,
      password: strong,
      confirmPassword: strong,
    });
    if (stronger.status !== 200 || stronger.body?.notice !== true || stronger.body?.message !== SIGNUP_CHECK_EMAIL || stronger.cookie) {
      throw new Error(`${weak} blocked a stronger password`);
    }
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
  if (created.body?.notice !== true || again.body?.notice !== true) {
    throw new Error("signup marks the check-email response as a notice");
  }
  if (created.cookie || again.cookie || created.body?.account || again.body?.error) {
    throw new Error("signup does not reveal whether the email exists");
  }
  const takenMail = captured.filter((message) => message.subject === SIGNUP_TAKEN_SUBJECT);
  if (
    takenMail.length !== 1 ||
    takenMail[0]?.to !== "fresh-one@example.com" ||
    takenMail[0]?.subject !== "Someone tried to sign up with your email" ||
    takenMail[0]?.text !== signupTakenText() ||
    takenMail[0]?.text !==
      "Someone just tried to create an XV-AIsle account with this email address. You already have an account, so nothing changed. If it was you, sign in or reset your password. If it wasn't you, you can ignore this email. Questions? Email us at support@example.test."
  ) {
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

  const { assertProductionAppUrl } = await import("../src/lib/server/same-origin");
  const bootErrors: string[] = [];
  const writeBoot = console.error;
  console.error = (...args: unknown[]) => {
    bootErrors.push(args.map((part) => String(part)).join(" "));
  };
  const bootEnv = process.env.NODE_ENV;
  const bootUrl = process.env.APP_URL;
  const bootPhase = process.env.NEXT_PHASE;
  try {
    setNodeEnv("development");
    delete process.env.APP_URL;
    assertProductionAppUrl();
    setNodeEnv("production");
    process.env.NEXT_PHASE = "phase-production-build";
    assertProductionAppUrl();
    delete process.env.NEXT_PHASE;
    let missingThrew = false;
    try {
      assertProductionAppUrl();
    } catch {
      missingThrew = true;
    }
    if (!missingThrew) throw new Error("production refuses to boot without APP_URL");
    process.env.APP_URL = "not a url";
    let invalidThrew = false;
    try {
      assertProductionAppUrl();
    } catch {
      invalidThrew = true;
    }
    if (!invalidThrew) throw new Error("production refuses to boot with an invalid APP_URL");
    process.env.APP_URL = "https://xvaisle.com";
    assertProductionAppUrl();
    if (!bootErrors.join("\n").includes("APP_URL is missing or invalid")) {
      throw new Error("a bad APP_URL is logged at boot");
    }
  } finally {
    console.error = writeBoot;
    setNodeEnv(bootEnv);
    if (bootUrl == null) delete process.env.APP_URL;
    else process.env.APP_URL = bootUrl;
    if (bootPhase == null) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = bootPhase;
  }

  const { trustProxyChecklist } = await import("../scripts/deploy-ready");
  const ready = trustProxyChecklist("1");
  const unset = trustProxyChecklist(undefined);
  if (!ready.ok || !ready.label.includes("Caddy") || !ready.label.includes("TRUST_PROXY=1")) {
    throw new Error("TRUST_PROXY=1 matches Caddy");
  }
  if (unset.ok || !unset.label.includes("TRUST_PROXY=1") || !unset.label.includes("Caddy") || /leave it unset/i.test(unset.label)) {
    throw new Error("an unset TRUST_PROXY is not ready behind Caddy");
  }
  const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const compose = readFileSync(new URL("../docker-compose.yml", import.meta.url), "utf8");
  const deploy = readFileSync(new URL("./deploy-ready.ts", import.meta.url), "utf8");
  const bootFile = readFileSync(new URL("../src/instrumentation.ts", import.meta.url), "utf8");
  for (const [name, text] of [
    [".env.example", example],
    ["README", readme],
    ["deploy-ready", deploy],
  ] as const) {
    if (!text.includes("TRUST_PROXY") || !text.includes("Caddy")) {
      throw new Error(`${name} should set TRUST_PROXY=1 behind Caddy`);
    }
    if (/leave it unset/i.test(text)) throw new Error(`${name} should not say to leave TRUST_PROXY unset`);
  }
  if (!compose.includes('TRUST_PROXY: "1"') || !compose.includes("caddy")) {
    throw new Error("Docker Compose sets TRUST_PROXY=1 behind Caddy");
  }
  if (!bootFile.includes("assertProductionAppUrl()") || !bootFile.includes("assertProductionSupportEmail()") || !bootFile.includes("sweepRateHits()")) {
    throw new Error("boot checks APP_URL and SUPPORT_EMAIL and sweeps rate hits");
  }
  const supportLine = example.split("\n").find((line) => line.startsWith("SUPPORT_EMAIL="));
  if (supportLine !== "SUPPORT_EMAIL=") throw new Error("SUPPORT_EMAIL example stays blank");
  const copySource = readFileSync(new URL("../src/lib/signup-copy.ts", import.meta.url), "utf8");
  if (copySource.includes("@") || example.includes("xvaisle.team@gmail.com") || readme.includes("xvaisle.team@gmail.com")) {
    throw new Error("the support address stays in the environment");
  }

  const { assertProductionSupportEmail } = await import("../src/lib/signup-copy");
  const supportErrors: string[] = [];
  const writeSupport = console.error;
  console.error = (...args: unknown[]) => {
    supportErrors.push(args.map((part) => String(part)).join(" "));
  };
  const supportEnv = process.env.NODE_ENV;
  const supportMail = process.env.SUPPORT_EMAIL;
  const supportPhase = process.env.NEXT_PHASE;
  try {
    setNodeEnv("development");
    delete process.env.SUPPORT_EMAIL;
    assertProductionSupportEmail();
    setNodeEnv("production");
    process.env.NEXT_PHASE = "phase-production-build";
    assertProductionSupportEmail();
    delete process.env.NEXT_PHASE;
    let missingSupport = false;
    try {
      assertProductionSupportEmail();
    } catch {
      missingSupport = true;
    }
    if (!missingSupport) throw new Error("production refuses to boot without SUPPORT_EMAIL");
    process.env.SUPPORT_EMAIL = "   ";
    let blankSupport = false;
    try {
      assertProductionSupportEmail();
    } catch {
      blankSupport = true;
    }
    if (!blankSupport) throw new Error("production refuses to boot when SUPPORT_EMAIL is blank");
    process.env.SUPPORT_EMAIL = "support@example.test";
    assertProductionSupportEmail();
    if (!supportErrors.join("\n").includes("SUPPORT_EMAIL is unset")) {
      throw new Error("an unset SUPPORT_EMAIL is logged at boot");
    }
  } finally {
    console.error = writeSupport;
    setNodeEnv(supportEnv);
    if (supportMail == null) delete process.env.SUPPORT_EMAIL;
    else process.env.SUPPORT_EMAIL = supportMail;
    if (supportPhase == null) delete process.env.NEXT_PHASE;
    else process.env.NEXT_PHASE = supportPhase;
  }

  console.log("sign-in hardening checks ok");
}

checkPasswordReset()
  .then(() => checkSignInHardening())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
