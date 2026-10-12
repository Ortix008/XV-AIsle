import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signInWithX } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { profileFromXCode } from "@/lib/server/x-auth";
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

export async function GET(request: Request) {
  if (!xSignInConfigured()) return new Response("Not found.", { status: 404 });
  if (!allowAttempt(clientBucket(request, "x-callback"), 20, 15 * 60 * 1000)) {
    return clearOauth(NextResponse.redirect(`${appOrigin()}/sign-in?x=failed`));
  }
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const jar = await cookies();
  const expectedState = jar.get(X_STATE_COOKIE)?.value;
  const verifier = jar.get(X_VERIFIER_COOKIE)?.value;
  if (url.searchParams.get("error") || !statesMatch(expectedState, state) || !isCodeVerifier(verifier)) {
    return failed();
  }
  const profile = await profileFromXCode({ code, verifier });
  if (!profile) return failed();
  const result = signInWithX({ xUserId: profile.id, name: profile.name });
  if ("error" in result) return failed();
  if ("totpRequired" in result && result.challenge) {
    const response = clearOauth(NextResponse.redirect(`${appOrigin()}/sign-in?x=code`));
    response.cookies.set(X_TOTP_COOKIE, result.challenge, xTotpCookieOptions());
    return response;
  }
  if (!("token" in result) || !result.token) return failed();
  const dest = result.account.needsEmail ? "/account" : "/";
  const response = clearOauth(NextResponse.redirect(`${appOrigin()}${dest}`));
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return response;
}
