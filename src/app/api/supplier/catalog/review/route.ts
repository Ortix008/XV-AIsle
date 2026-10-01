import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { reviewCatalogItem } from "@/lib/server/catalog";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const body = (await request.json().catch(() => null)) as { id?: string; approved?: boolean } | null;
  if (!body?.id || typeof body.approved !== "boolean") {
    return Response.json({ error: "Name the product and whether you approve it." }, { status: 400 });
  }
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const result = reviewCatalogItem(account, body.id, body.approved);
  if ("error" in result && result.status !== 200) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ item: "item" in result ? result.item : null });
}
