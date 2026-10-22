import { NextResponse } from "next/server";
import { requestPasswordReset } from "@/lib/server/accounts";
import { allowAccount, allowClient } from "@/lib/server/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  if (!body || typeof body.email !== "string") {
    return NextResponse.json({ error: "Send the email on the account." }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  if (!allowClient(request, "reset", 5, WINDOW_MS) || !allowAccount("reset", email, 5, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  await requestPasswordReset(body.email);
  return NextResponse.json({
    ok: true,
    message: "If that email has an account, we'll email you a reset link.",
  });
}
