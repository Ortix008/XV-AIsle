import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, referralId } from "@/lib/referral";
import { accountFromToken } from "@/lib/server/accounts";
import { entryRedirect } from "@/lib/server/entry-gate";
import { postOriginAllowed } from "@/lib/server/same-origin";
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

function withSecurity(response: NextResponse, request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  const path = request.nextUrl.pathname;
  if (path === "/reset" || path.startsWith("/reset/")) {
    response.headers.set("Referrer-Policy", "no-referrer");
  }
  return response;
}

function homeRedirect(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.search = "";
  return withSecurity(withReferral(NextResponse.redirect(url, 307), request), request);
}

export function proxy(request: NextRequest) {
  if (!postOriginAllowed(request)) {
    return withSecurity(NextResponse.json({}, { status: 403 }), request);
  }
  const path = request.nextUrl.pathname;
  if (path === "/account" || path === "/sign-in") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const dest = entryRedirect(path, accountFromToken(token));
    if (dest) {
      const url = request.nextUrl.clone();
      url.pathname = dest;
      url.search = "";
      return withSecurity(withReferral(NextResponse.redirect(url), request), request);
    }
  }
  if (path === "/desk") {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    const account = accountFromToken(token);
    if (account && (account.role !== "admin" || !account.emailVerified)) return homeRedirect(request);
  }
  return withSecurity(withReferral(NextResponse.next(), request), request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
