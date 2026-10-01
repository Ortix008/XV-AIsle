import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { readReturnsAddress, saveReturnsFor } from "@/lib/server/settings";

export async function GET() {
  return Response.json({ returns: readReturnsAddress() });
}

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "returns"), 20, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const body = (await request.json().catch(() => null)) as { returns?: string } | null;
  if (!body || typeof body.returns !== "string") {
    return Response.json({ error: "Send the return address." }, { status: 400 });
  }
  const saved = saveReturnsFor(account, body.returns);
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ returns: saved.returns });
}
