import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { quoteForAccount } from "@/lib/server/publish";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
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
