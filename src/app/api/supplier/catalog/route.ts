import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { createCatalogItem, listApprovedCatalog } from "@/lib/server/catalog";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  return Response.json({
    items: listApprovedCatalog().map((item) => ({
      id: item.id,
      sku: item.sku,
      title: item.title,
      costCents: item.costCents,
      shippingCents: item.shippingCents,
      origin: item.origin,
      supplierName: item.supplierName,
    })),
  });
}

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    sku?: string;
    title?: string;
    costCents?: number;
    shippingCents?: number;
    origin?: string;
  } | null;
  if (!body) return Response.json({ error: "Name the item." }, { status: 400 });
  const result = createCatalogItem(account, {
    sku: body.sku ?? "",
    title: body.title ?? "",
    costCents: body.costCents ?? -1,
    shippingCents: body.shippingCents ?? -1,
    origin: body.origin ?? "",
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ item: result.item });
}
