import type { Metadata } from "next";
import Link from "next/link";
import { ResellerWaitlist } from "@/components/reseller-waitlist";
import { PolicyArticle } from "@/components/policy-article";
import { viewerIsOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = { title: "Reseller program · XV-AIsle" };

export function ResellerArticle({ operator = false }: { operator?: boolean }) {
  return (
    <PolicyArticle operator={operator} resellerContact kicker="Store" title="Reseller program coming soon.">
      <ResellerWaitlist />
      <p>
        {`We do not promise income. A listing can sell, or it can sell nothing. We don't promise any amount you'll make. Full terms come when the reseller program opens.`}
      </p>
      <p>
        Buyers pay on xvaisle.com. The supplier ships the box. The{" "}
        <Link href="/shop/terms" className="underline underline-offset-4">
          terms of sale
        </Link>{" "}
        cover a purchase. The short version of the program is on this page, and the{" "}
        <Link href="/shop/reseller/terms" className="underline underline-offset-4">
          reseller terms
        </Link>{" "}
        will be decided after launch.
      </p>
    </PolicyArticle>
  );
}

export default async function ResellerPage() {
  const operator = await viewerIsOperator();
  return <ResellerArticle operator={operator} />;
}
