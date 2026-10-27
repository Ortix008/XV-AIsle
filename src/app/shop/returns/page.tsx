import type { Metadata } from "next";
import { PolicyArticle } from "@/components/policy-article";
import { RETURNS_POLICY_HEADING, returnsPolicyLines } from "@/lib/returns-policy";
import { viewerIsOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = { title: "Returns · XV-AIsle" };

export function ReturnsCopy({ operator = false }: { operator?: boolean }) {
  return (
    <PolicyArticle band kicker="Store" title={RETURNS_POLICY_HEADING} operator={operator}>
      {returnsPolicyLines().map((line) => (
        <p key={line}>{line}</p>
      ))}
    </PolicyArticle>
  );
}

export default async function ReturnsPage() {
  return <ReturnsCopy operator={await viewerIsOperator()} />;
}
