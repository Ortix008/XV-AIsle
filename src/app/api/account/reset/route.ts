import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "reset"), 5, 15 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "Send the email on the account." }, { status: 400 });
  }
  await requestPasswordReset(body.email);
  return NextResponse.json({
    ok: true,
    message: "If that email has an account, we'll email you a reset link.",
  });
}
