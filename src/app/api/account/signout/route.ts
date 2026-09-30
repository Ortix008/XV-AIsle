import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { endSession } from "@/lib/server/accounts";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session-cookie";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  endSession(token);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
