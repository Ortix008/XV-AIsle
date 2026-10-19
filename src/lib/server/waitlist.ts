import { isSupportEmail } from "./settings";
import { getDb } from "./db";

/** Email-only reseller waitlist. No Stripe call and no charge. */
export function joinResellerWaitlist(email: string) {
  const address = email.trim().toLowerCase();
  if (address.length > 120 || !isSupportEmail(address)) return { error: "Add an email." as const };
  getDb()
    .prepare("INSERT INTO reseller_waitlist (email, created_at) VALUES (?, ?) ON CONFLICT(email) DO NOTHING")
    .run(address, Date.now());
  return { ok: true as const };
}
