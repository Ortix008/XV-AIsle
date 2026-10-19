import type { Metadata } from "next";
import { SignUpScreen } from "@/components/auth-screens";
import { xSignInConfigured, xSignInReviewable } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open an account · XV-AIsle",
  description: "Open a free XV-AIsle account.",
};

export default function SignUpPage() {
  const configured = xSignInConfigured();
  const review = xSignInReviewable();
  return <SignUpScreen showX={configured || review} xDisabled={review && !configured} />;
}
