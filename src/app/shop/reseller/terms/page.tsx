import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { RESELLER_DISCLOSURE, RETURN_WINDOW_DAYS, resellerCommissionLabel } from "@/lib/policies";

export const metadata: Metadata = { title: "Reseller terms · XV-AIsle" };

export default function ResellerTermsPage() {
  return (
    <PolicyArticle kicker="Store" title="Affiliate and reseller terms">
      <p>The reseller program is free to join. There is no fee to open an account or to publish a listing.</p>
      <p>
        Commission is {resellerCommissionLabel()} of a completed sale on xvaisle.com. A signup, a click, or a post is
        not a sale. Commission is paid only when a customer completes a purchase.
      </p>
      <p>Commission is paid monthly, after the {RETURN_WINDOW_DAYS}-day return window closes.</p>
      <p>
        We do not promise income. A listing can sell, or it can sell nothing. We do not quote example earnings, and we
        do not say what you will make.
      </p>
      <p>
        If you mention a product in a post, video, or message, say that you earn a commission. Use these words:{" "}
        <span className="font-medium">{RESELLER_DISCLOSURE}</span>
      </p>
      <p>XV can remove a listing that breaks these rules.</p>
      <p>
        The short version is on the{" "}
        <Link href="/shop/reseller" className="underline underline-offset-4">
          reseller program
        </Link>{" "}
        page.
      </p>
    </PolicyArticle>
  );
}
