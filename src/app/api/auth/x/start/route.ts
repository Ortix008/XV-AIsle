import { NextResponse } from "next/server";
import { allowClient } from "@/lib/server/rate-limit";
import {
  buildAuthorizeUrl,
  codeChallenge,
  createCodeVerifier,
  createState,
  X_STATE_COOKIE,
  X_VERIFIER_COOKIE,
  xOauthCookieOptions,
  xSignInConfigured,
} from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!xSignInConfigured()) return new Response("Not found.", { status: 404 });
  if (!allowClient(request, "x-start", 20, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const state = createState();
  const verifier = createCodeVerifier();
  const clientId = process.env.X_CLIENT_ID?.trim() ?? "";
  const redirectUri = process.env.X_REDIRECT_URI?.trim() ?? "";
  const authorize = buildAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    challenge: codeChallenge(verifier),
  });
  const response = NextResponse.redirect(authorize);
  const options = xOauthCookieOptions();
  response.cookies.set(X_STATE_COOKIE, state, options);
  response.cookies.set(X_VERIFIER_COOKIE, verifier, options);
  return response;
}
