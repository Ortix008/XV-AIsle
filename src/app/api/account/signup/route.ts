import { NextResponse } from "next/server";
import { SIGNUP_CHECK_EMAIL, SIGNUP_TAKEN_SUBJECT, signupTakenText } from "@/lib/signup-copy";
import { signUp } from "@/lib/server/accounts";
import { logBackgroundMailError, sendMail } from "@/lib/server/mail";
import { allowAccount, allowClient } from "@/lib/server/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;

function checkEmail() {
  return NextResponse.json({ message: SIGNUP_CHECK_EMAIL, notice: true });
}

function badSignup() {
  return NextResponse.json({ error: "Send a name, email, and password." }, { status: 400 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object" || Array.isArray(body)) return badSignup();
  const name = body.name;
  const emailValue = body.email;
  const password = body.password;
  const confirmPassword = body.confirmPassword;
  if (
    (emailValue != null && typeof emailValue !== "string") ||
    (password != null && typeof password !== "string") ||
    (name != null && typeof name !== "string") ||
    (confirmPassword != null && typeof confirmPassword !== "string")
  ) {
    return badSignup();
  }
  const email = (typeof emailValue === "string" ? emailValue : "").trim().toLowerCase();
  if (!allowClient(request, "signup", 5, WINDOW_MS) || !allowAccount("signup", email, 5, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many tries. Wait a few minutes and try again." }, { status: 429 });
  }
  const passwordText = typeof password === "string" ? password : "";
  const confirmText = typeof confirmPassword === "string" ? confirmPassword : "";
  if (confirmText !== passwordText) {
    return NextResponse.json({ error: "Those passwords do not match." }, { status: 400 });
  }
  const result = signUp({
    name: typeof name === "string" ? name : "",
    email: typeof emailValue === "string" ? emailValue : "",
    password: passwordText,
  });
  if ("error" in result && result.error === "That email already has an account. Sign in instead.") {
    void sendMail({ to: result.email, subject: SIGNUP_TAKEN_SUBJECT, text: signupTakenText() }).catch(logBackgroundMailError);
    return checkEmail();
  }
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return checkEmail();
}
