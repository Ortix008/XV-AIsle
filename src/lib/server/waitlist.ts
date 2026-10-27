import { WAITLIST_EMAIL_FORMAT } from "../waitlist-copy";
import { isSupportEmail } from "./settings";
import { getDb } from "./db";

/** Email-only reseller waitlist. No Stripe call and no charge. */
export function joinResellerWaitlist(email: string) {
  const address = email.trim().toLowerCase();
  if (!address || address.length > 120) return { error: "Add an email." as const };
  if (!isSupportEmail(address)) return { error: WAITLIST_EMAIL_FORMAT };
  getDb()
    .prepare("INSERT INTO reseller_waitlist (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
    .run(address, Date.now());
  return { ok: true as const };
}
