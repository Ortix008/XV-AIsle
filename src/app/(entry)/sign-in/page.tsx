import type { Metadata } from "next";
import { SignInScreen } from "@/components/auth-screens";
import { xSignInConfigured } from "@/lib/x-oauth";

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
  const params = await searchParams;
  const notice = Array.isArray(params.x) ? params.x[0] : params.x;
  const xNotice = notice === "code" || notice === "failed" ? notice : null;
  return <SignInScreen showX={xSignInConfigured()} xNotice={xNotice} />;
}
