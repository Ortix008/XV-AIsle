import { getDb } from "./db";

const RETURNS_KEY = "returns_address";

export function readReturnsAddress() {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(RETURNS_KEY) as
    | { value: string }
    | undefined;
  const stored = row?.value.trim() ?? "";
  if (stored) return stored;
  return process.env.STORE_RETURNS?.trim() ?? "";
}

export function saveReturnsAddress(value: string) {
  const address = value.trim().replace(/\s+/g, " ");
  if (address.length > 200) return { error: "Shorten the return address." as const };
  if (address.length > 0 && address.length < 8) return { error: "Add the street, city, and state." as const };
  const db = getDb();
  if (!address) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(RETURNS_KEY);
    return { address: "" };
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(RETURNS_KEY, address);
  return { address };
}
