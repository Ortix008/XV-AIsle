import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { addSmallShop, listSmallShops } from "@/lib/server/small-shops";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ shops: listSmallShops() });
}

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "small-shop"), 20, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many updates. Wait a few minutes." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
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
