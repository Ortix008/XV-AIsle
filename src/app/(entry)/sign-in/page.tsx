import type { Metadata } from "next";
import { SignInScreen } from "@/components/auth-screens";

export const metadata: Metadata = {
  title: "Sign in · XV-AIsle",
  description: "Sign in to your XV-AIsle account.",
};

export default function SignInPage() {
  return <SignInScreen />;
}
