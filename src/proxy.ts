import { NextResponse, type NextRequest } from "next/server";
import { REFERRAL_COOKIE, referralId } from "@/lib/referral";

export function proxy(request: NextRequest) {
  const ref = referralId(request.nextUrl.searchParams.get("ref"));
  if (!ref) return NextResponse.next();
  const response = NextResponse.next();
  response.cookies.set(REFERRAL_COOKIE, ref, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)"],
};
