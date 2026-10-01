import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accountFromToken, confirmTotp, startTotp } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "totp"), 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { action?: string; code?: string } | null;
  if (body?.action === "start") {
    const result = startTotp(account.id);
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  }
  if (body?.action === "confirm") {
    const result = confirmTotp(account.id, body.code ?? "");
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ account: result.account });
  }
  return NextResponse.json({ error: "Start setup, then confirm the code from your authenticator app." }, { status: 400 });
}
