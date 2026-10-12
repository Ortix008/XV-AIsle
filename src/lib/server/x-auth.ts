import { xSignInConfigured } from "../x-oauth";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const PROFILE_URL = "https://api.x.com/2/users/me?user.fields=id,name";

const OAUTH_ERROR_NAMES = new Set([
  "access_denied",
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
  "server_error",
  "temporarily_unavailable",
]);

/** A short OAuth error name, or unknown. Never the raw query or response body. */
export function safeOauthLabel(value: unknown) {
  if (typeof value !== "string") return "unknown";
  const name = value.trim().toLowerCase();
  return OAUTH_ERROR_NAMES.has(name) ? name : "unknown";
}

function logAuth(reason: string) {
  console.info(`x-auth: ${reason}`);
}

function errorName(payload: unknown) {
  if (!payload || typeof payload !== "object") return "unknown";
  return safeOauthLabel((payload as { error?: unknown }).error);
}

async function readLimitedJson(response: Response) {
  const text = await response.text();
  if (text.length > 8000) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function accessTokenFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const token = (payload as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || token.length < 8 || token.length > 4096) return null;
  return token;
}

function profileFrom(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const id = (data as { id?: unknown }).id;
  const name = (data as { name?: unknown }).name;
  if (typeof id !== "string" || !/^\d{1,32}$/.test(id)) return null;
  return { id, name: typeof name === "string" ? name : "" };
}

/**
 * Exchanges the authorization code, reads the X user id, and drops the access token.
 * The token is not returned and is not written anywhere.
 */
export async function profileFromXCode(input: { code: string; verifier: string }) {
  if (!xSignInConfigured()) {
    logAuth("signin_error");
    return null;
  }
  const clientId = process.env.X_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.X_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.X_REDIRECT_URI?.trim() ?? "";
  if (input.code.length < 8 || input.code.length > 2048) {
    logAuth("token_exchange status=0 error=bad_code");
    return null;
  }
  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: redirectUri,
      code_verifier: input.verifier,
      client_id: clientId,
    });
    const basic = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString("base64");
    const tokenResponse = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const tokenPayload = await readLimitedJson(tokenResponse);
    const accessToken = tokenResponse.ok ? accessTokenFrom(tokenPayload) : null;
    if (!accessToken) {
      const error = tokenResponse.ok ? "missing_token" : errorName(tokenPayload);
      logAuth(`token_exchange status=${tokenResponse.status} error=${error}`);
      return null;
    }
    const profileResponse = await fetch(PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const profilePayload = await readLimitedJson(profileResponse);
    if (!profileResponse.ok) {
      logAuth(`profile_fetch status=${profileResponse.status}`);
      return null;
    }
    const profile = profileFrom(profilePayload);
    if (!profile) logAuth(`profile_fetch status=${profileResponse.status}`);
    return profile;
  } catch {
    logAuth("token_exchange status=0 error=unreachable");
    return null;
  }
}
