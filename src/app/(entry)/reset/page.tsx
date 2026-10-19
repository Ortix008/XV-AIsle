import type { Metadata } from "next";
import { ResetRequestScreen } from "@/components/auth-screens";

export const metadata: Metadata = {
  title: "Password help · XV-AIsle",
  description: "We'll email you a reset link. We reply within 2 business days.",
};

export default function ResetRequestPage() {
  return <ResetRequestScreen />;
}
