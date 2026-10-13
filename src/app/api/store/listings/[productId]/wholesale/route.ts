import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { saveWholesaleCost } from "@/lib/server/money-flow";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

async function sessionToken(request: Request) {
  try {
    return (await cookies()).get(SESSION_COOKIE)?.value;
  } catch {
    const header = request.headers.get("cookie");
    if (!header) return undefined;
    for (const part of header.split(";")) {
      const [name, ...rest] = part.trim().split("=");
      if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
    }
    return undefined;
  }
}

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  const account = accountFromToken(await sessionToken(request));
  const { productId } = await context.params;
  const body = (await request.json().catch(() => null)) as { wholesaleCost?: number } | null;
  const saved = saveWholesaleCost(account, productId, body?.wholesaleCost ?? -1);
  if (saved.status !== 200) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ productId, wholesaleCost: saved.wholesaleCost });
}
