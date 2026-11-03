const WEBHOOK_PATHS = new Set([
  "/api/billing/webhook",
  "/api/connect/webhook",
  "/api/supplier/delivered",
  "/api/supplier/catalog",
]);

function configuredAppUrl() {
  const raw = process.env.APP_URL?.trim() ?? "";
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

function configuredOrigin() {
  return configuredAppUrl()?.origin ?? null;
}

/**
 * Production has to know its public origin before it serves a POST.
 * A missing APP_URL used to refuse every state-changing request with a bare 403.
 */
export function assertProductionAppUrl() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (configuredAppUrl()) return;
  const message =
    "APP_URL is missing or invalid. Production will not start until APP_URL is an absolute http(s) URL, for example https://xvaisle.com.";
  console.error(message);
  throw new Error(message);
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
 * True when Origin, or Referer if Origin is absent, is the configured app origin.
 * A missing or invalid APP_URL does not match.
 */
export function requestFromAppOrigin(request: Request) {
  const expected = configuredOrigin();
  if (!expected) return false;
  const presented = headerOrigin(request.headers.get("origin")) ?? headerOrigin(request.headers.get("referer"));
  return presented === expected;
}

/**
 * State-changing POST must come from APP_URL.
 * Origin is checked first. Referer is the fallback when Origin is absent.
 * Stripe webhooks and the two supplier callbacks are signed server-to-server
 * posts and are exempt. Supplier routes check their own HMAC.
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
  return requestFromAppOrigin(request);
}
