import { createHash } from "node:crypto";
import { RESELLER_DISCLOSURE } from "../src/lib/policies";
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
} from "../src/lib/x-oauth";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const saved = {
  id: process.env.X_CLIENT_ID,
  secret: process.env.X_CLIENT_SECRET,
  redirect: process.env.X_REDIRECT_URI,
  nodeEnv: process.env.NODE_ENV,
};

function setNodeEnv(value: string | undefined) {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

function restoreEnv() {
  process.env.X_CLIENT_ID = saved.id;
  process.env.X_CLIENT_SECRET = saved.secret;
  process.env.X_REDIRECT_URI = saved.redirect;
  setNodeEnv(saved.nodeEnv);
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

setNodeEnv("development");
const devCookies = xOauthCookieOptions();
assert(devCookies.httpOnly === true, "oauth cookies are httpOnly");
assert(devCookies.sameSite === "lax", "oauth cookies are SameSite=Lax");
assert(devCookies.path === "/", "oauth cookies use the site path");
assert(devCookies.maxAge === 600, "oauth cookies last 10 minutes");
assert(devCookies.secure === false, "development cookies are not Secure");
setNodeEnv("production");
assert(xOauthCookieOptions().secure === true, "production cookies are Secure");
setNodeEnv("development");

delete process.env.X_CLIENT_ID;
delete process.env.X_CLIENT_SECRET;
delete process.env.X_REDIRECT_URI;
assert(!xSignInConfigured(), "missing env hides X sign-in");
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

restoreEnv();
console.log("x oauth checks ok");
