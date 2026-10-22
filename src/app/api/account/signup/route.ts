import { NextResponse } from "next/server";
import { SIGNUP_CHECK_EMAIL, SIGNUP_TAKEN_SUBJECT, SIGNUP_TAKEN_TEXT } from "@/lib/signup-copy";
import { signUp } from "@/lib/server/accounts";
import { sendMail } from "@/lib/server/mail";
import { allowAccount, allowClient } from "@/lib/server/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

function checkEmail() {
  return NextResponse.json({ message: SIGNUP_CHECK_EMAIL });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "Send a name, email, and password." }, { status: 400 });
  const email = (body.email ?? "").trim().toLowerCase();
  if (!allowClient(request, "signup", 5, WINDOW_MS) || !allowAccount("signup", email, 5, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  if ((body.confirmPassword ?? "") !== (body.password ?? "")) {
    return NextResponse.json({ error: "Those passwords do not match." }, { status: 400 });
  }
  const result = signUp({
    name: body.name ?? "",
    email: body.email ?? "",
    password: body.password ?? "",
  });
  if ("error" in result && result.error === "That email already has an account. Sign in instead.") {
    void sendMail({ to: result.email, subject: SIGNUP_TAKEN_SUBJECT, text: SIGNUP_TAKEN_TEXT });
    return checkEmail();
  }
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return checkEmail();
}
