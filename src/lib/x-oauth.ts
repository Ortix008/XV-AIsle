import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Read-only profile lookup. No refresh token, no post permission, no email scope. */
export const X_SCOPES = "users.read tweet.read";

export const X_STATE_COOKIE = "xvaisle_x_state";
export const X_VERIFIER_COOKIE = "xvaisle_x_verifier";
export const X_TOTP_COOKIE = "xvaisle_x_totp";

const OAUTH_MAX_AGE = 10 * 60;
const TOTP_MAX_AGE = 5 * 60;
const VERIFIER_PATTERN = /^[A-Za-z0-9\-._~]{43,128}$/;

export function xScopesAllowed(scopes: string) {
  const parts = scopes.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return false;
  if (parts.includes("offline.access")) return false;
  if (parts.includes("users.email")) return false;
  if (parts.includes("tweet.write")) return false;
  if (parts.includes("media.write")) return false;
  return parts.includes("users.read") && parts.includes("tweet.read");
}

export function redirectUriAllowed(value: string) {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === "https:") return true;
    const local = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    return url.protocol === "http:" && local;
  } catch {
    return false;
  }
}

export function xSignInConfigured() {
  const clientId = process.env.X_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.X_REDIRECT_URI?.trim() ?? "";
  if (!clientId || !clientSecret || !redirectUri) return false;
  if (!xScopesAllowed(X_SCOPES)) return false;
  return redirectUriAllowed(redirectUri);
}

type ReviewEnv = {
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

/** Preview and local dev only. Production stays hidden when X is not configured. */
export function xSignInReviewable(env: ReviewEnv = process.env) {
  if (env.VERCEL_ENV === "production") return false;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development") return true;
  return env.NODE_ENV !== "production";
}

function appUrlIsHttps() {
  return (process.env.APP_URL ?? "").trim().toLowerCase().startsWith("https://");
}

export function xOauthCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: appUrlIsHttps(),
    path: "/",
    maxAge: OAUTH_MAX_AGE,
  };
}

export function xTotpCookieOptions() {
  return { ...xOauthCookieOptions(), maxAge: TOTP_MAX_AGE };
}

export function createCodeVerifier() {
  return randomBytes(32).toString("base64url");
}

export function isCodeVerifier(value: string | undefined): value is string {
  return typeof value === "string" && VERIFIER_PATTERN.test(value);
}

export function codeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createState() {
  return randomBytes(32).toString("base64url");
}

export function statesMatch(expected: string | undefined, received: string | undefined) {
  if (!expected || !received) return false;
  if (expected.length !== received.length) return false;
  if (expected.length < 32 || expected.length > 128) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

export function buildAuthorizeUrl(input: { clientId: string; redirectUri: string; state: string; challenge: string }) {
  if (!xScopesAllowed(X_SCOPES)) throw new Error("X scopes are not allowed.");
  const url = new URL("https://x.com/i/oauth2/authorize");
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
    code_challenge: input.challenge,
    code_challenge_method: "S256",
  });
  const next = `${url.origin}${url.pathname}?${params.toString()}&scope=${encodeURIComponent(X_SCOPES)}`;
  if (!next.startsWith("https://x.com/i/oauth2/authorize?")) throw new Error("X authorize URL drifted.");
  return next;
}
