import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { accountFromToken, sendAccountVerification, verifyEmailToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { appOrigin } from "@/lib/server/stripe";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  const result = verifyEmailToken(token);
  if ("error" in result) return new Response(result.error, { status: 400 });
  return NextResponse.redirect(`${appOrigin()}/membership?verified=1`);
}

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const sent = await sendAccountVerification(account.id);
  if ("error" in sent) return Response.json({ error: sent.error }, { status: 400 });
  return Response.json({ sent: true });
}
