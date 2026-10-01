import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { rotateSupplierSecret } from "@/lib/server/supplier-secret";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const result = rotateSupplierSecret(account.id);
  if ("error" in result) return Response.json({ error: result.error }, { status: 403 });
  return Response.json({ secret: result.secret });
}
