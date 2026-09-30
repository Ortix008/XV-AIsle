import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getAccount } from "./accounts";
import { getDb } from "./db";

function hashSecret(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

export function rotateSupplierSecret(accountId: string) {
  const account = getAccount(accountId);
  if (!account || account.role !== "supplier") {
    return { error: "Only a supplier can rotate a delivery secret." as const };
  }
  const secret = randomBytes(32).toString("hex");
  getDb()
    .prepare(
      `INSERT INTO supplier_secrets (account_id, secret_hash, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(account_id) DO UPDATE SET secret_hash = excluded.secret_hash, updated_at = excluded.updated_at`,
    )
    .run(accountId, hashSecret(secret), Date.now());
  return { secret };
}

export function supplierSecretMatches(accountId: string, presented: string | null) {
  if (!presented || presented.length < 16 || presented.length > 200) return false;
  const row = getDb()
    .prepare("SELECT secret_hash FROM supplier_secrets WHERE account_id = ?")
    .get(accountId) as { secret_hash: string } | undefined;
  if (!row) return false;
  const left = Buffer.from(hashSecret(presented));
  const right = Buffer.from(row.secret_hash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
