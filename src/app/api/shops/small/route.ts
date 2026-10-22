import { accountFromToken } from "@/lib/server/accounts";
import { operatorOnly } from "@/lib/server/access";
import { allowClient } from "@/lib/server/rate-limit";
import { sessionTokenFromRequest } from "@/lib/server/session-cookie";
import { addSmallShop, listSmallShops } from "@/lib/server/small-shops";

function accountFrom(request: Request) {
  return accountFromToken(sessionTokenFromRequest(request));
}

export async function GET(request: Request) {
  const denied = operatorOnly(accountFrom(request));
  if (denied) return Response.json({ error: denied.error }, { status: denied.status });
  return Response.json({ shops: listSmallShops() });
}

export async function POST(request: Request) {
  if (!allowClient(request, "small-shop", 20, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many updates. Wait a few minutes." }, { status: 429 });
  }
  const account = accountFrom(request);
  const denied = operatorOnly(account);
  if (denied || !account) return Response.json({ error: denied?.error ?? "Sign in first." }, { status: denied?.status ?? 401 });
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    city?: string;
    makes?: string;
    madeInUsa?: boolean;
  } | null;
  if (!body) return Response.json({ error: "Name the business." }, { status: 400 });
  const result = addSmallShop(account.id, {
    name: body.name ?? "",
    city: body.city ?? "",
    makes: body.makes ?? "",
    madeInUsa: body.madeInUsa === true,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ shop: result.shop, shops: listSmallShops() });
}
