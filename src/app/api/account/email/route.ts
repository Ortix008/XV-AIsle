import { cookies } from "next/headers";
import { accountFromToken, setReceiptEmail } from "@/lib/server/accounts";
import { allowClient } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!allowClient(request, "account-email", 8, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const result = setReceiptEmail(account.id, body?.email ?? "");
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ account: result.account });
}
