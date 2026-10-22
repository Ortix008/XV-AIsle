const WEBHOOK_PATHS = new Set(["/api/billing/webhook", "/api/connect/webhook"]);

function configuredOrigin() {
  const raw = process.env.APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

function headerOrigin(value: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * State-changing POST must come from APP_URL.
 * Origin is checked first. Referer is the fallback when Origin is absent.
 * Stripe webhooks are signed server-to-server posts and are exempt.
 */
export function postOriginAllowed(request: Request) {
  if (request.method !== "POST") return true;
  let pathname = "";
  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return false;
  }
  if (WEBHOOK_PATHS.has(pathname)) return true;
  const expected = configuredOrigin();
  if (!expected) return false;
  const presented = headerOrigin(request.headers.get("origin")) ?? headerOrigin(request.headers.get("referer"));
  return presented === expected;
}
