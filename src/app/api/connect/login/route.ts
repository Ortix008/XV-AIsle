import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { beginDashboard } from "@/lib/server/connect";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const result = await beginDashboard(account);
    if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ url: result.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe did not open the dashboard.";
    return Response.json({ error: message }, { status: 502 });
  }
}
