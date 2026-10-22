const DEFAULT_SITE_URL = "https://xvaisle.com";

function localHost(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost");
}

/** Public origin for share links and social cards. A localhost value is ignored so the request host cannot leak in. */
export function publicSiteUrl() {
  const configured = process.env.PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  try {
    const url = new URL(configured);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password || localHost(url.hostname)) {
      return DEFAULT_SITE_URL;
    }
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

export function productPageUrl(productId: string) {
  return `${publicSiteUrl()}/shop/${productId}`;
}
