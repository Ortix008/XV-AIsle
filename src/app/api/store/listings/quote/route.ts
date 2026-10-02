import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { quoteForAccount } from "@/lib/server/publish";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

async function sessionToken(request: Request) {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    const header = request.headers.get("cookie");
    if (!header) return undefined;
    for (const part of header.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === SESSION_COOKIE) return rest.join("=");
    }
    return undefined;
  }
}

export async function POST(request: Request) {
  const account = accountFromToken(await sessionToken(request));
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (account.role !== "admin" && account.role !== "reseller") {
    return Response.json({ error: "Only a reseller can request a quote." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    catalogItemId?: string;
    priceCents?: number;
    feeBps?: number;
    platformFeeCents?: number;
    stripeFeeCents?: number;
    resellerAmountCents?: number;
  } | null;
  if (!body?.catalogItemId) return Response.json({ error: "Choose a supplier-approved catalog item." }, { status: 400 });
  const result = quoteForAccount({
    catalogItemId: body.catalogItemId,
    priceCents: body.priceCents ?? 0,
  });
  if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ quote: result.quote });
}
