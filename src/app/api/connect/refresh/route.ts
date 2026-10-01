import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { beginOnboarding } from "@/lib/server/connect";
import { appOrigin } from "@/lib/server/stripe";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const origin = appOrigin();
  if (!account) return Response.redirect(`${origin}/`);
  try {
    const result = await beginOnboarding(account);
    if (result.status === 200) return Response.redirect(result.url);
  } catch {
    return Response.redirect(`${origin}/membership?connect=retry`);
  }
  return Response.redirect(`${origin}/membership?connect=retry`);
}
