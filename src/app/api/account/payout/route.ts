import { cookies } from "next/headers";
import { accountFromToken, savePayout } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import type { PayoutMethod } from "@/lib/payout";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    method?: PayoutMethod;
    name?: string;
    number?: string;
    expiry?: string;
    routing?: string;
    account?: string;
    address?: string;
  } | null;
  if (!body?.method) return Response.json({ error: "Choose where the profit lands." }, { status: 400 });
  const result = savePayout(account.id, { ...body, method: body.method });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ payout: result.payout });
}
