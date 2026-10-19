import type { Metadata } from "next";
import { ResetConfirmScreen } from "@/components/auth-screens";

export const metadata: Metadata = {
  title: "Reset · XV-AIsle",
  description: "Choose a new password from the link we emailed you.",
};

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? (params.token[0] ?? "") : (params.token ?? "");
  return <ResetConfirmScreen token={token} />;
}
