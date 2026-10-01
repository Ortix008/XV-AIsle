import { randomBytes, randomUUID, scryptSync } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { DatabaseSync } from "node:sqlite";

const path = process.env.DATABASE_PATH ?? "data/xvaisle.sqlite";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

async function ask(label) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = (await rl.question(label)).trim();
  rl.close();
  return answer;
}

function allowlist() {
  const raw = process.env.ADMIN_EMAILS?.trim() ?? "";
  if (!raw) return null;
  return new Set(
    raw
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}

async function main() {
  let email = process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
  let password = process.env.ADMIN_PASSWORD ?? "";
  const name = process.env.ADMIN_NAME?.trim() || "Operator";
  if (!email) {
    if (!stdin.isTTY) throw new Error("Set ADMIN_EMAIL or run this in a terminal.");
    email = (await ask("Email: ")).toLowerCase();
  }
  if (email.length > 120 || !email.includes("@") || !email.includes(".")) throw new Error("That email does not look right.");
  const allowed = allowlist();
  if (allowed && !allowed.has(email)) {
    throw new Error("That email is not on ADMIN_EMAILS. The list does not grant admin on signup.");
  }

  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      member_since INTEGER,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      role TEXT NOT NULL DEFAULT 'buyer',
      membership_status TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0
    );
  `);
  const cols = db.prepare("PRAGMA table_info(accounts)").all();
  if (!cols.some((col) => col.name === "email_verified")) {
    db.exec("ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.some((col) => col.name === "role")) {
    db.exec("ALTER TABLE accounts ADD COLUMN role TEXT NOT NULL DEFAULT 'buyer'");
  }
  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(email);
  if (existing) {
    db.prepare("UPDATE accounts SET role = 'admin', email_verified = 1 WHERE id = ?").run(existing.id);
    stdout.write("Promoted the existing account to a verified admin. Name, password, membership, and orders were left in place.\n");
  } else {
    if (!password) {
      if (!stdin.isTTY) throw new Error("Set ADMIN_PASSWORD or run this in a terminal.");
      password = await ask("Password: ");
    }
    if (name.length < 2 || name.length > 80) throw new Error("ADMIN_NAME must be 2 to 80 characters.");
    if (password.length < 8 || password.length > 200) throw new Error("Use a password of 8 to 200 characters.");
    const { salt, hash } = hashPassword(password);
    db.prepare(
      `INSERT INTO accounts (
         id, name, email, password_hash, password_salt, created_at, member_since,
         stripe_customer_id, stripe_subscription_id, role, email_verified
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'admin', 1)`,
    ).run(randomUUID(), name, email, hash, salt, Date.now());
    stdout.write("Created a verified admin.\n");
  }
  db.close();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Admin was not created.";
  console.error(message);
  process.exitCode = 1;
});
