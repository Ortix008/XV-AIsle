import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json(
    { error: "Membership is not offered. Existing subscriptions are left as they are." },
    { status: 410 },
  );
}
