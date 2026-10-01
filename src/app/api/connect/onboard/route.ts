import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { beginOnboarding } from "@/lib/server/connect";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "connect-onboard"), 10, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many payout setup tries. Wait a few minutes." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  try {
    const result = await beginOnboarding(account);
    if (result.status !== 200) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ url: result.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe did not open payout setup.";
    return Response.json({ error: message }, { status: 502 });
  }
}
