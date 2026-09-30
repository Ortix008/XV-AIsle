import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { deliverFor } from "@/lib/server/order-actions";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { carrier?: string; tracking?: string } | null;
  const result = await deliverFor(account, id, { carrier: body?.carrier, tracking: body?.tracking });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ order: result.order, released: result.released });
}
