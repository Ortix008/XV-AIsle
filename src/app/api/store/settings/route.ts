import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { allowClient } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { readReturnsAddress, readSupportEmail, saveReturnsFor, saveSupportFor } from "@/lib/server/settings";

export async function GET() {
  return Response.json({ returns: readReturnsAddress(), supportEmail: readSupportEmail() });
}

export async function POST(request: Request) {
  if (!allowClient(request, "returns", 20, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const body = (await request.json().catch(() => null)) as { returns?: unknown; supportEmail?: unknown } | null;
  const hasReturns = typeof body?.returns === "string";
  const hasEmail = typeof body?.supportEmail === "string";
  if (!body || (!hasReturns && !hasEmail)) {
    return Response.json({ error: "Send the return address or the support email." }, { status: 400 });
  }
  let returns = readReturnsAddress();
  let supportEmail = readSupportEmail();
  if (hasReturns && typeof body.returns === "string") {
    const saved = saveReturnsFor(account, body.returns);
    if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
    returns = saved.returns;
  }
  if (hasEmail && typeof body.supportEmail === "string") {
    const saved = saveSupportFor(account, body.supportEmail);
    if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
    supportEmail = saved.supportEmail;
  }
  return Response.json({ returns, supportEmail });
}
