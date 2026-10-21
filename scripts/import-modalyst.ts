import { getDb } from "../src/lib/server/db";
import { importModalystForAccount } from "../src/lib/server/modalyst-import";

function fail(message: string) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

const email = process.env.STORE_OPERATOR_EMAIL?.trim().toLowerCase() ?? "";
if (!email) {
  fail("Set STORE_OPERATOR_EMAIL to an existing admin.");
} else {
  const account = getDb().prepare("SELECT id, role FROM accounts WHERE email = ?").get(email) as
    | { id: string; role: string }
    | undefined;
  if (!account) {
    fail("That admin account is not on file.");
  } else {
    const result = await importModalystForAccount(account);
    if (result.error) {
      fail(result.error);
    } else {
      for (const id of result.imported ?? []) process.stdout.write(`${id} → unpublished\n`);
      for (const item of result.skipped ?? []) process.stdout.write(`${item.id} → skipped: ${item.reason}\n`);
    }
  }
}
