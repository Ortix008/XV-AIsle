import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signInWithX } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { profileFromXCode, safeOauthLabel } from "@/lib/server/x-auth";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { appOrigin } from "@/lib/server/stripe";
import {
  isCodeVerifier,
  statesMatch,
  X_STATE_COOKIE,
  X_TOTP_COOKIE,
  X_VERIFIER_COOKIE,
  xOauthCookieOptions,
  xSignInConfigured,
  xTotpCookieOptions,
} from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

function clearOauth(response: NextResponse) {
  const options = { ...xOauthCookieOptions(), maxAge: 0 };
  response.cookies.set(X_STATE_COOKIE, "", options);
  response.cookies.set(X_VERIFIER_COOKIE, "", options);
  return response;
}

function failed() {
  return clearOauth(NextResponse.redirect(`${appOrigin()}/sign-in?x=failed`));
}

export function xCallbackLogLine(
  kind: "rate_limited" | "x_error" | "state_mismatch" | "missing_verifier" | "signin_error",
  xError?: string | null,
) {
  if (kind === "x_error") return `x-callback: x_error=${safeOauthLabel(xError)}`;
  return `x-callback: ${kind}`;
}

function logCallback(kind: "rate_limited" | "x_error" | "state_mismatch" | "missing_verifier" | "signin_error", xError?: string | null) {
  console.info(xCallbackLogLine(kind, xError));
}

export async function GET(request: Request) {
  if (!xSignInConfigured()) return new Response("Not found.", { status: 404 });
  if (!allowAttempt(clientBucket(request, "x-callback"), 20, 15 * 60 * 1000)) {
    logCallback("rate_limited");
    return clearOauth(NextResponse.redirect(`${appOrigin()}/sign-in?x=failed`));
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const xError = url.searchParams.get("error");
  const jar = await cookies();
  const expectedState = jar.get(X_STATE_COOKIE)?.value;
  const verifier = jar.get(X_VERIFIER_COOKIE)?.value;
  if (xError) {
    logCallback("x_error", xError);
    return failed();
  }
  if (!statesMatch(expectedState, state)) {
    logCallback("state_mismatch");
    return failed();
  }
  if (!isCodeVerifier(verifier)) {
    logCallback("missing_verifier");
    return failed();
  }
  const profile = await profileFromXCode({ code, verifier });
  if (!profile) return failed();
  const result = signInWithX({ xUserId: profile.id, name: profile.name });
  if ("error" in result) {
    logCallback("signin_error");
    return failed();
  }
  if ("totpRequired" in result && result.challenge) {
    const response = clearOauth(NextResponse.redirect(`${appOrigin()}/sign-in?x=code`));
    response.cookies.set(X_TOTP_COOKIE, result.challenge, xTotpCookieOptions());
    return response;
  }
  if (!("token" in result) || !result.token) {
    logCallback("signin_error");
    return failed();
  }
  const dest = result.account.needsEmail ? "/account" : "/";
  const response = clearOauth(NextResponse.redirect(`${appOrigin()}${dest}`));
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return response;
}
