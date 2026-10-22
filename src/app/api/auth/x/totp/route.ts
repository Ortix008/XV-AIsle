import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { finishTotpSignIn } from "@/lib/server/accounts";
import { allowAccount, allowClient } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";
import { X_TOTP_COOKIE, xTotpCookieOptions } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allowClient(request, "x-totp", 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { code?: string } | null;
  const challenge = (await cookies()).get(X_TOTP_COOKIE)?.value ?? "";
  const result = finishTotpSignIn(challenge, body?.code ?? "");
  if ("error" in result) {
    const accountId = "accountId" in result ? result.accountId : undefined;
    if (accountId && !allowAccount("totp", accountId, 8, 15 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
    }
    const message = result.error ?? "That sign-in step expired. Enter your password again.";
    const response = NextResponse.json({ error: message }, { status: 400 });
    if (message.includes("expired")) {
      response.cookies.set(X_TOTP_COOKIE, "", { ...xTotpCookieOptions(), maxAge: 0 });
    }
    return response;
  }
  const response = NextResponse.json({ account: result.account });
  response.cookies.set(X_TOTP_COOKIE, "", { ...xTotpCookieOptions(), maxAge: 0 });
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return response;
}
