import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, referralId } from "@/lib/referral";
import { accountFromToken } from "@/lib/server/accounts";
import { entryRedirect } from "@/lib/server/entry-gate";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

function withReferral(response: NextResponse, request: NextRequest) {
  const ref = referralId(request.nextUrl.searchParams.get("ref"));
  if (!ref) return response;
  response.cookies.set(REFERRAL_COOKIE, ref, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path === "/account" || path === "/sign-in") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const dest = entryRedirect(path, accountFromToken(token));
    if (dest) {
      const url = request.nextUrl.clone();
      url.pathname = dest;
      url.search = "";
      return withReferral(NextResponse.redirect(url), request);
    }
  }
  return withReferral(NextResponse.next(), request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
