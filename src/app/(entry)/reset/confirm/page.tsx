import type { Metadata } from "next";
import { ResetConfirmScreen } from "@/components/auth-screens";

export const metadata: Metadata = {
  title: "Reset · XV-AIsle",
  description: "This page does not set a new password. Write from Contact and a person replies within 24 hours.",
};

export default function ResetConfirmPage() {
  return <ResetConfirmScreen />;
}