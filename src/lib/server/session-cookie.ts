export const SESSION_COOKIE = "xvaisle_session";

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
