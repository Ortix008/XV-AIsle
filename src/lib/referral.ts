/** Cookie set when a shopper arrives through a reseller ?ref= link. */
export const REFERRAL_COOKIE = "xv_ref";

const REFERRAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** A reseller account id from ?ref=. Anything else is ignored. */
export function referralId(value: string | null | undefined) {
  if (!value) return null;
  const text = value.trim();
  if (!REFERRAL_ID.test(text)) return null;
  return text.toLowerCase();
}

export function referralFromCookieHeader(header: string | null) {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== REFERRAL_COOKIE) continue;
    return referralId(decodeURIComponent(rest.join("=")));
  }
  return null;
}
