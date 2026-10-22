import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { xCallbackLogLine } from "../src/app/api/auth/x/callback/route";
import { RESELLER_DISCLOSURE } from "../src/lib/policies";
import { profileFromXCode } from "../src/lib/server/x-auth";
import { sessionCookieOptions } from "../src/lib/server/session-cookie";
import { buyerShareHref, resellerShareHref, xIntentUrl } from "../src/lib/x-share";
import {
  buildAuthorizeUrl,
  codeChallenge,
  createCodeVerifier,
  isCodeVerifier,
  statesMatch,
  X_SCOPES,
  xOauthCookieOptions,
  xScopesAllowed,
  xSignInConfigured,
  xSignInReviewable,
} from "../src/lib/x-oauth";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const authScreens = readFileSync(join(process.cwd(), "src/components/auth-screens.tsx"), "utf8");
function authSlice(name: string, next: string) {
  const start = authScreens.indexOf(`export function ${name}`);
  const end = authScreens.indexOf(`export function ${next}`);
  assert(start >= 0 && end > start, `${name} is in the auth screens`);
  return authScreens.slice(start, end);
}
for (const [name, next] of [
  ["SignInScreen", "SignUpScreen"],
  ["SignUpScreen", "ResetRequestScreen"],
] as const) {
  const form = authSlice(name, next);
  const markup = form.slice(form.indexOf("return ("));
  const button = markup.indexOf("<ContinueWithX");
  const divider = markup.indexOf("<AuthOr />");
  const email = markup.indexOf("Email");
  const password = markup.indexOf('label="Password"');
  assert(button >= 0 && divider > button && email > divider && password > email, `${name} puts Continue with X, then or, then email and password`);
}
assert(
  authScreens.includes('className="auth-x-mark"') && authScreens.includes('aria-hidden="true"') && authScreens.includes("Continue with X"),
  "Continue with X shows the X mark",
);
assert(!authScreens.includes("/brand/logo-official-xo.png"), "Continue with X does not use the old logo");
assert(!authScreens.includes("auth-email-row"), "Continue with X is not beside the email field");

const saved = {
  id: process.env.X_CLIENT_ID,
  secret: process.env.X_CLIENT_SECRET,
  redirect: process.env.X_REDIRECT_URI,
  nodeEnv: process.env.NODE_ENV,
  appUrl: process.env.APP_URL,
};

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function setAppUrl(value: string | undefined) {
  if (value == null) delete process.env.APP_URL;
  else process.env.APP_URL = value;
}

function restoreEnv() {
  process.env.X_CLIENT_ID = saved.id;
  process.env.X_CLIENT_SECRET = saved.secret;
  process.env.X_REDIRECT_URI = saved.redirect;
  setNodeEnv(saved.nodeEnv);
  setAppUrl(saved.appUrl);
}

assert(X_SCOPES === "users.read tweet.read", "scopes are users.read and tweet.read");
assert(xScopesAllowed(X_SCOPES), "the fixed scope list is allowed");
assert(!xScopesAllowed("users.read tweet.read offline.access"), "offline.access is refused");
assert(!xScopesAllowed("users.read tweet.read users.email"), "users.email is refused");
assert(!xScopesAllowed("tweet.write tweet.read users.read"), "tweet.write is refused");
assert(!xScopesAllowed("users.read"), "tweet.read is required");
assert(!X_SCOPES.includes("offline.access"), "the shipped scope string has no refresh scope");

assert(!statesMatch(undefined, "a".repeat(43)), "missing expected state fails");
assert(!statesMatch("a".repeat(43), undefined), "missing received state fails");
assert(!statesMatch("", "a".repeat(43)), "empty state fails");
assert(!statesMatch("a".repeat(43), "a".repeat(42)), "different lengths fail");
assert(!statesMatch("short", "short"), "short state fails");
assert(!statesMatch("a".repeat(43), `${"a".repeat(42)}b`), "same-length mismatch fails");
assert(statesMatch("a".repeat(43), "a".repeat(43)), "matching state passes");

const verifier = createCodeVerifier();
assert(isCodeVerifier(verifier), "generated verifier matches the PKCE charset and length");
assert(verifier.length >= 43 && verifier.length <= 128, "generated verifier length is 43 to 128");
assert(!isCodeVerifier("short"), "short verifier fails");
assert(!isCodeVerifier(`${"a".repeat(42)} `), "verifier rejects characters outside the PKCE set");
assert(!isCodeVerifier("a".repeat(129)), "verifier longer than 128 fails");

const rfcVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const rfcChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
assert(isCodeVerifier(rfcVerifier), "RFC 7636 verifier is accepted");
assert(codeChallenge(rfcVerifier) === rfcChallenge, "S256 challenge matches the RFC 7636 vector");
assert(
  codeChallenge(verifier) === createHash("sha256").update(verifier).digest("base64url"),
  "challenge is sha256 base64url of the verifier",
);

const authorize = buildAuthorizeUrl({
  clientId: "client",
  redirectUri: "https://xvaisle.com/api/auth/x/callback",
  state: "a".repeat(43),
  challenge: rfcChallenge,
});
assert(authorize.startsWith("https://x.com/i/oauth2/authorize?"), "authorize URL stays on x.com");
assert(authorize.includes("code_challenge_method=S256"), "PKCE method is S256");
assert(authorize.includes(`code_challenge=${rfcChallenge}`), "authorize URL carries the challenge");
assert(authorize.includes("scope=users.read%20tweet.read"), "scope is the two read scopes");
assert(!authorize.includes(rfcVerifier), "authorize URL does not carry the verifier");
assert(!authorize.includes("offline.access"), "authorize URL does not ask for a refresh token");
assert(!authorize.includes("tweet.write"), "authorize URL does not ask to post");

setAppUrl("http://127.0.0.1:4317");
setNodeEnv("production");
const devCookies = xOauthCookieOptions();
assert(devCookies.httpOnly === true, "oauth cookies are httpOnly");
assert(devCookies.sameSite === "lax", "oauth cookies are SameSite=Lax");
assert(devCookies.path === "/", "oauth cookies use the site path");
assert(devCookies.maxAge === 600, "oauth cookies last 10 minutes");
assert(devCookies.secure === false, "an http APP_URL leaves oauth cookies unset for Secure");
assert(sessionCookieOptions().secure === true, "production marks the session cookie Secure even when APP_URL is http");
setAppUrl("https://xvaisle.com");
setNodeEnv("development");
assert(xOauthCookieOptions().secure === true, "an https APP_URL marks oauth cookies Secure");
assert(sessionCookieOptions().secure === true, "an https APP_URL marks the session cookie Secure");
setAppUrl(" HTTPS://xvaisle.com ");
assert(xOauthCookieOptions().secure === true, "the https check ignores case and surrounding space");
setAppUrl("http://127.0.0.1:4317");

delete process.env.X_CLIENT_ID;
delete process.env.X_CLIENT_SECRET;
delete process.env.X_REDIRECT_URI;
assert(!xSignInConfigured(), "missing env hides X sign-in");
assert(xSignInReviewable({ NODE_ENV: "development" }), "local dev can review the X button");
assert(xSignInReviewable({ NODE_ENV: "production", VERCEL_ENV: "preview" }), "a preview deploy can review the X button");
assert(!xSignInReviewable({ NODE_ENV: "production" }), "production without X stays hidden");
assert(!xSignInReviewable({ NODE_ENV: "development", VERCEL_ENV: "production" }), "a production deploy does not show a disabled X button");
assert(authScreens.includes("disabled={xDisabled}"), "an unconfigured preview disables Continue with X");
assert(!authScreens.includes("sk_test") && !authScreens.includes("X_CLIENT_SECRET"), "the auth screen does not embed credentials");
process.env.X_CLIENT_ID = "  ";
process.env.X_CLIENT_SECRET = "secret";
process.env.X_REDIRECT_URI = "https://xvaisle.com/api/auth/x/callback";
assert(!xSignInConfigured(), "blank client id hides X sign-in");
process.env.X_CLIENT_ID = "client";
process.env.X_REDIRECT_URI = "http://evil.example/api/auth/x/callback";
assert(!xSignInConfigured(), "a non-local http redirect is refused");
process.env.X_REDIRECT_URI = "http://127.0.0.1:4317/api/auth/x/callback";
assert(xSignInConfigured(), "localhost http callback is allowed");
process.env.X_REDIRECT_URI = "https://xvaisle.com/api/auth/x/callback";
assert(xSignInConfigured(), "https callback is allowed");

const intent = new URL(xIntentUrl({ text: "Quarter sheet pan", url: "https://xvaisle.com/shop/sheet-pan" }));
assert(`${intent.origin}${intent.pathname}` === "https://x.com/intent/post", "share uses the web intent");
assert(intent.searchParams.get("text") === "Quarter sheet pan", "intent text is the product name");
assert(intent.searchParams.get("url") === "https://xvaisle.com/shop/sheet-pan", "intent url is the product page");

const accountId = "6f0c1a2e-1111-4222-8333-abcdefabcdef";
const reseller = new URL(
  resellerShareHref({
    title: "Quarter sheet pan and rack",
    productUrl: "https://xvaisle.com/shop/sheet-pan?ref=drop-me",
    accountId,
  }),
);
assert(reseller.searchParams.get("text")?.includes("Quarter sheet pan and rack"), "reseller text includes the product name");
assert(reseller.searchParams.get("text")?.includes(RESELLER_DISCLOSURE), "reseller text includes the commission line");
const resellerUrl = new URL(reseller.searchParams.get("url") ?? "");
assert(resellerUrl.searchParams.get("ref") === accountId, "reseller url uses the account id");
assert(!reseller.search.includes("@"), "reseller intent does not carry an email");
assert(!resellerUrl.search.includes("@"), "referral link does not carry an email");

const buyer = new URL(
  buyerShareHref({
    title: "Quarter sheet pan and rack",
    productUrl: `https://xvaisle.com/shop/sheet-pan?ref=${accountId}`,
  }),
);
assert(buyer.searchParams.get("text") === "Quarter sheet pan and rack", "buyer text is only the product name");
assert(!buyer.searchParams.get("text")?.includes(RESELLER_DISCLOSURE), "buyer text omits the ad line");
assert(!new URL(buyer.searchParams.get("url") ?? "").searchParams.has("ref"), "buyer url drops a referral");

const code = "code-marker-9f3a2c-not-an-oauth-name";
const secret = "secret-marker-b7c1-not-an-oauth-name";
const leakVerifier = "verifier-marker-E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
process.env.X_CLIENT_ID = "client";
process.env.X_CLIENT_SECRET = secret;
process.env.X_REDIRECT_URI = "https://xvaisle.com/api/auth/x/callback";
const logs: string[] = [];
const originalInfo = console.info;
console.info = (...args: unknown[]) => {
  logs.push(args.map((part) => String(part)).join(" "));
};
const originalFetch = globalThis.fetch;

async function checkLogs() {
  try {
    console.info(xCallbackLogLine("x_error", `${code} ${secret} ${leakVerifier}`));
    console.info(xCallbackLogLine("x_error", "access_denied"));
    console.info(xCallbackLogLine("rate_limited"));
    console.info(xCallbackLogLine("state_mismatch"));
    console.info(xCallbackLogLine("missing_verifier"));
    console.info(xCallbackLogLine("signin_error"));
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          error: secret,
          error_description: `${code} ${leakVerifier} ${secret}`,
          access_token: `token-${secret}`,
        }),
        { status: 400 },
      );
    assert((await profileFromXCode({ code, verifier: leakVerifier })) == null, "a refused token exchange returns no profile");
    let step = 0;
    globalThis.fetch = async () => {
      step += 1;
      if (step === 1) {
        return new Response(
          JSON.stringify({ access_token: `bearer-${secret}`, error_description: `${code} ${leakVerifier}` }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ detail: `${code} ${secret} ${leakVerifier}` }), { status: 401 });
    };
    assert((await profileFromXCode({ code, verifier: leakVerifier })) == null, "a refused profile fetch returns no profile");
    globalThis.fetch = async () => {
      throw new Error(`boom ${code} ${secret} ${leakVerifier}`);
    };
    assert((await profileFromXCode({ code, verifier: leakVerifier })) == null, "a thrown exchange returns no profile");
  } finally {
    console.info = originalInfo;
    globalThis.fetch = originalFetch;
  }
  const dumped = logs.join("\n");
  assert(!dumped.includes(code), "logs omit the authorization code");
  assert(!dumped.includes(leakVerifier), "logs omit the verifier");
  assert(!dumped.includes(secret), "logs omit the client secret");
  assert(dumped.includes("x-callback: x_error=unknown"), "a raw callback error is not copied into the log");
  assert(dumped.includes("x-callback: x_error=access_denied"), "a known callback error is logged");
  assert(dumped.includes("x-callback: rate_limited"), "rate limit is logged");
  assert(dumped.includes("x-callback: state_mismatch"), "state mismatch is logged");
  assert(dumped.includes("x-callback: missing_verifier"), "a missing verifier is logged");
  assert(dumped.includes("x-callback: signin_error"), "sign-in failure is logged");
  assert(dumped.includes("x-auth: token_exchange status=400 error=unknown"), "token failure logs status without the body");
  assert(dumped.includes("x-auth: profile_fetch status=401"), "profile failure logs the status");
  assert(dumped.includes("x-auth: token_exchange status=0 error=unreachable"), "a thrown exchange logs a fixed reason");
}

void checkLogs()
  .then(() => {
    restoreEnv();
    console.log("x oauth checks ok");
  })
  .catch((error: unknown) => {
    restoreEnv();
    console.error(error);
    process.exit(1);
  });
