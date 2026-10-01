import { existsSync } from "node:fs";
import { stdout, stderr } from "node:process";
import { DatabaseSync } from "node:sqlite";

const dbPath = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!email) fail("Set ADMIN_EMAIL.");
  if (dbPath !== ":memory:" && !existsSync(dbPath)) fail("No database at DATABASE_PATH.");
  const db = new DatabaseSync(dbPath);
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'accounts'").get();
  if (!table) {
    stdout.write("account: no\n");
    db.close();
    return;
  }
  const cols = new Set(
    (db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[]).map((col) => col.name),
  );
  const row = db.prepare("SELECT role FROM accounts WHERE email = ?").get(email) as { role: string } | undefined;
  if (!row) {
    stdout.write("account: no\n");
    db.close();
    return;
  }
  let failedLogins = 0;
  let lockedUntil: number | null = null;
  if (cols.has("failed_logins") && cols.has("locked_until")) {
    const lock = db
      .prepare("SELECT failed_logins, locked_until FROM accounts WHERE email = ?")
      .get(email) as { failed_logins: number | null; locked_until: number | null };
    failedLogins = lock.failed_logins ?? 0;
    lockedUntil = lock.locked_until;
  }
  const remainingMs = (lockedUntil ?? 0) - Date.now();
  const locked = remainingMs > 0;
  const lockedMinutes = locked ? Math.max(1, Math.ceil(remainingMs / 60_000)) : 0;
  stdout.write("account: yes\n");
  stdout.write(`role: ${row.role}\n`);
  stdout.write(`failed_logins: ${failedLogins}\n`);
  stdout.write(`locked: ${locked ? "yes" : "no"}\n`);
  stdout.write(`locked_minutes: ${lockedMinutes}\n`);
  db.close();
}

main();
