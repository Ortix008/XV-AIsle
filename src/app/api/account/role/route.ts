import { cookies } from "next/headers";
import { accountFromToken, setOwnRole } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { role?: string } | null;
  if (body?.role !== "reseller" && body?.role !== "supplier") {
    return Response.json({ error: "Choose reseller or supplier." }, { status: 400 });
  }
  const result = setOwnRole(account.id, body.role);
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ account: result.account });
}
