import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { joinResellerWaitlist } from "@/lib/server/waitlist";

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "waitlist"), 5, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const result = joinResellerWaitlist(body?.email ?? "");
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
