import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCOUNT_CACHE_CONTROL } from "@/lib/account-cache";
import { endSession } from "@/lib/server/accounts";
import { SESSION_COOKIE, sessionCookieOptions, sessionTokenFromRequest } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const token = sessionTokenFromRequest(request) ?? (await cookies()).get(SESSION_COOKIE)?.value;
  endSession(token);
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": ACCOUNT_CACHE_CONTROL } });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
