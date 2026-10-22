export const SESSION_COOKIE = "xvaisle_session";

export function sessionTokenFromRequest(request: Request) {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const piece = part.trim();
    const eq = piece.indexOf("=");
    if (eq <= 0) continue;
    if (piece.slice(0, eq) !== SESSION_COOKIE) continue;
    return decodeURIComponent(piece.slice(eq + 1));
  }
  return undefined;
}

/** Secure only when the public site is https. Local http previews stay usable. */
export function appUrlIsHttps() {
  return (process.env.APP_URL ?? "").trim().toLowerCase().startsWith("https://");
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: appUrlIsHttps(),
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  };
}
