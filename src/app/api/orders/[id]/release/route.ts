import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { approveFor } from "@/lib/server/order-actions";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const { id } = await context.params;
  const result = await approveFor(account, id);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ order: result.order, released: result.released });
}
