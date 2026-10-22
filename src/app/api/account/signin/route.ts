import { NextResponse } from "next/server";
import { finishTotpSignIn, signIn } from "@/lib/server/accounts";
import { allowAccount, allowClient } from "@/lib/server/rate-limit";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";

const WINDOW_MS = 15 * 60 * 1000;
const LIMIT = 8;
const THROTTLED = "Too many tries. Wait a few minutes and try again.";

function throttled() {
  return NextResponse.json({ error: THROTTLED }, { status: 429 });
}

function badInput() {
  return NextResponse.json({ error: "Send an email and password." }, { status: 400 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
    challenge?: unknown;
    code?: unknown;
  } | null;
  if (!body || typeof body !== "object") return badInput();
  if (body.challenge != null) {
    if (typeof body.challenge !== "string" || (body.code != null && typeof body.code !== "string")) return badInput();
    const result = finishTotpSignIn(body.challenge, typeof body.code === "string" ? body.code : "");
    if ("error" in result) {
      const accountId = "accountId" in result ? result.accountId : undefined;
      const accountLimited = accountId ? !allowAccount("totp", accountId, LIMIT, WINDOW_MS) : false;
      const ipLimited = !allowClient(request, "totp", LIMIT, WINDOW_MS);
      if (accountLimited || ipLimited) return throttled();
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const response = NextResponse.json({ account: result.account });
    response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    return response;
  }
  if ((body.email != null && typeof body.email !== "string") || (body.password != null && typeof body.password !== "string")) {
    return badInput();
  }
  const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const result = signIn({ email, password });
  if ("error" in result) {
    // Count the miss. A later correct password does not consult this bucket.
    const accountLimited = !allowAccount("signin", email, LIMIT, WINDOW_MS);
    const ipLimited = !allowClient(request, "signin", LIMIT, WINDOW_MS);
    if (accountLimited || ipLimited) return throttled();
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  if ("totpRequired" in result) {
    return NextResponse.json({ totpRequired: true, challenge: result.challenge });
  }
  const response = NextResponse.json({ account: result.account });
  response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions());
  return response;
}
