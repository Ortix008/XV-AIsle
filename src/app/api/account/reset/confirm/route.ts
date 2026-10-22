import { NextResponse } from "next/server";
import { consumePasswordReset } from "@/lib/server/accounts";
import { allowClient } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  if (!allowClient(request, "reset-confirm", 8, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { token?: string; password?: string } | null;
  if (!body || typeof body.token !== "string" || typeof body.password !== "string") {
    return NextResponse.json({ error: "Send the reset link and a new password." }, { status: 400 });
  }
  const result = consumePasswordReset(body.token, body.password);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
