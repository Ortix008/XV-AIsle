import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { importModalystForAccount } from "@/lib/server/modalyst-import";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const result = await importModalystForAccount(account);
  if (result.error) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ imported: result.imported, skipped: result.skipped }, { status: result.status });
}
