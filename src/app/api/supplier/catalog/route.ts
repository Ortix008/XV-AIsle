import { cookies } from "next/headers";
import { accountFromToken, type PublicAccount } from "@/lib/server/accounts";
import { createCatalogItem, listApprovedCatalog } from "@/lib/server/catalog";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

async function signedInAccount(request?: Request) {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (token) return accountFromToken(token);
  } catch {
    // The route test sends the session on the request instead of the Next cookie store.
  }
  const header = request?.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return accountFromToken(decodeURIComponent(rest.join("=")));
  }
  return null;
}

function canSeeCost(account: PublicAccount, ownerId: string) {
  if (account.role === "admin") return true;
  return account.role === "supplier" && account.id === ownerId;
}

export async function GET(request?: Request) {
  const account = await signedInAccount(request);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({
    items: listApprovedCatalog().map((item) => {
      const row: {
        id: string;
        sku: string;
        title: string;
        origin: string;
        supplierName: string;
        costCents?: number;
        shippingCents?: number;
      } = {
        id: item.id,
        sku: item.sku,
        title: item.title,
        origin: item.origin,
        supplierName: item.supplierName,
      };
      if (canSeeCost(account, item.accountId)) {
        row.costCents = item.costCents;
        row.shippingCents = item.shippingCents;
      }
      return row;
    }),
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
