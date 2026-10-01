import { NextResponse } from "next/server";
import { finishTotpSignIn, signIn } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "signin"), 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    password?: string;
    challenge?: string;
    code?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Send an email and password." }, { status: 400 });
  const result = body.challenge
    ? finishTotpSignIn(body.challenge, body.code ?? "")
    : signIn({ email: body.email ?? "", password: body.password ?? "" });
  if ("error" in result) {
    const status = "locked" in result && result.locked ? 429 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  if ("totpRequired" in result) {
    return NextResponse.json({ totpRequired: true, challenge: result.challenge });
  }
  const response = NextResponse.json({ account: result.account });
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return response;
}
