import { getDb } from "./db";

let cachedOperatorEmail = "";
let cachedOperatorId: string | null = null;

/**
 * One cached lookup of the account for STORE_OPERATOR_EMAIL.
 * The resolved id is cached for this process. After STORE_OPERATOR_EMAIL
 * changes, restart the server so the new account is used.
 * An unset email or an unknown account is not an own store.
 */
export function shelfOperatorId() {
  const preferred = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase() ?? "";
  if (!preferred) return null;
  if (cachedOperatorEmail === preferred && cachedOperatorId) return cachedOperatorId;
  const row = getDb().prepare("SELECT id FROM accounts WHERE email = ?").get(preferred) as { id: string } | undefined;
  if (!row) return null;
  cachedOperatorEmail = preferred;
  cachedOperatorId = row.id;
  return row.id;
}
