import { existsSync } from "node:fs";
import { stdin, stdout, stderr } from "node:process";
import { DatabaseSync } from "node:sqlite";
// Node's type stripper requires the .ts extension. tsc does not allow it.
// @ts-expect-error TS5097
import { hashPassword } from "../src/lib/server/password.ts";

const dbPath = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";

function fail(message: string): never {
  stderr.write(`${message}\n`);
  process.exit(1);
}

function readHidden(label: string) {
  return new Promise<string>((resolve) => {
    if (!stdin.isTTY) fail("Run this in a terminal. The password is not read from the environment or from arguments.");
    stdout.write(label);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === "\u0003") {
          stdin.setRawMode(false);
          stdin.off("data", onData);
          stdout.write("\n");
          process.exit(1);
        }
        if (char === "\r" || char === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          stdout.write("\n");
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") {
          value = value.slice(0, -1);
          continue;
        }
        if (char < " ") continue;
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

function tableExists(db: DatabaseSync, name: string) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function ensureLockColumns(db: DatabaseSync) {
  const cols = db.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!cols.some((col) => col.name === "failed_logins")) {
    db.exec("ALTER TABLE accounts ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.some((col) => col.name === "locked_until")) {
    db.exec("ALTER TABLE accounts ADD COLUMN locked_until INTEGER");
  }
}

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  if (!email) fail("Set ADMIN_EMAIL.");
  if (dbPath !== ":memory:" && !existsSync(dbPath)) fail("No database at DATABASE_PATH.");
  const db = new DatabaseSync(dbPath);
  if (!tableExists(db, "accounts")) fail("No account uses that email.");
  ensureLockColumns(db);
  const account = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email) as { id: string } | undefined;
  if (!account) fail("No account uses that email.");

  const password = await readHidden("New password: ");
  const repeat = await readHidden("Repeat password: ");
  if (password.length < 8 || password.length > 200) fail("Use a password of 8 to 200 characters.");
  if (password !== repeat) fail("Those passwords do not match.");

  const hashed = hashPassword(password);
  const updated = db
    .prepare(
      "UPDATE accounts SET password_hash = ?, password_salt = ?, failed_logins = 0, locked_until = NULL WHERE id = ?",
    )
    .run(hashed.hash, hashed.salt, account.id) as { changes: number };
  if (Number(updated.changes) !== 1) fail("No account uses that email.");
  if (tableExists(db, "sessions")) db.prepare("DELETE FROM sessions WHERE account_id = ?").run(account.id);
  if (tableExists(db, "login_challenges")) {
    db.prepare("DELETE FROM login_challenges WHERE account_id = ?").run(account.id);
  }
  db.close();
  stdout.write("Password reset. The lock is cleared and that account is signed out.\n");
}

main().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : "Password reset failed.");
});
