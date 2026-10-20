import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignInScreen } from "@/components/auth-screens";
import { accountFromToken } from "@/lib/server/accounts";
import { entryRedirect } from "@/lib/server/entry-gate";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { xSignInConfigured, xSignInReviewable } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in · XV-AIsle",
  description: "Sign in to your XV-AIsle account.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ x?: string | string[] }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const dest = entryRedirect("/sign-in", accountFromToken(token));
  if (dest) redirect(dest);
  const params = await searchParams;
  const notice = Array.isArray(params.x) ? params.x[0] : params.x;
  const xNotice = notice === "code" || notice === "failed" ? notice : null;
  const configured = xSignInConfigured();
  const review = xSignInReviewable();
  return <SignInScreen showX={configured || review} xDisabled={review && !configured} xNotice={xNotice} />;
}
