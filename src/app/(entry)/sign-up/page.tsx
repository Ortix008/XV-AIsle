import type { Metadata } from "next";
import { SignUpScreen } from "@/components/auth-screens";
import { xSignInConfigured } from "@/lib/x-oauth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open an account · XV-AIsle",
  description: "Open a free XV-AIsle account. Commission is 5% of a completed sale.",
};

export default function SignUpPage() {
  return <SignUpScreen showX={xSignInConfigured()} />;
}
