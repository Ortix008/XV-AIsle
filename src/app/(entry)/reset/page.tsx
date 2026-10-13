import type { Metadata } from "next";
import { ResetRequestScreen } from "@/components/auth-screens";

export const metadata: Metadata = {
  title: "Password help · XV-AIsle",
  description: "This shop does not email password reset links. A person replies within 24 hours.",
};

export default function ResetRequestPage() {
  return <ResetRequestScreen />;
}
