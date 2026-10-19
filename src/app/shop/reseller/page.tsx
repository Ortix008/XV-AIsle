import type { Metadata } from "next";
import Link from "next/link";
import { ResellerWaitlist } from "@/components/reseller-waitlist";
import { PolicyArticle } from "@/components/policy-article";
import { RESELLER_DISCLOSURE } from "@/lib/policies";

export const metadata: Metadata = { title: "Reseller program · XV-AIsle" };

export default function ResellerPage() {
  return (
    <PolicyArticle kicker="Earn with xvaisle" title="Resellers coming soon">
      <ResellerWaitlist />
      <p>We do not promise income. A listing can sell, or it can sell nothing. We do not quote example earnings, and we do not say what you will make.</p>
      <p>
        If you mention a product in a post, video, or message, say that you earn a commission. Use these words:{" "}
        <span className="font-medium">{RESELLER_DISCLOSURE}</span>
      </p>
      <p>
        Read the{" "}
        <Link href="/shop/reseller/terms" className="underline underline-offset-4">
          affiliate and reseller terms
        </Link>
        . Buyers pay on xvaisle.com. The supplier ships the box. The{" "}
        <Link href="/shop/terms" className="underline underline-offset-4">
          terms of sale
        </Link>{" "}
        cover a purchase.
      </p>
    </PolicyArticle>
  );
}
