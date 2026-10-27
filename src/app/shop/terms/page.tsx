import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";
import { viewerIsOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = { title: "Terms · XV-AIsle" };

export default async function TermsPage() {
  const operator = await viewerIsOperator();
  return (
    <PolicyArticle kicker="Store" title="Terms of sale" operator={operator}>
      <p>
        These terms cover a purchase on xvaisle.com. The price is the price on the product page. You pay that price on
        this site. Stripe processes the card. We do not see your card number.
      </p>
      <p>Orders ship to United States addresses. The supplier sends the box after payment clears.</p>
      <p>
        You can start a return within {RETURN_WINDOW_DAYS} days of delivery, unless a product page says otherwise. The{" "}
        <Link href="/shop/returns" className="underline underline-offset-4">
          returns page
        </Link>{" "}
        explains how. Shipping times are described on the{" "}
        <Link href="/shop/shipping" className="underline underline-offset-4">
          shipping page
        </Link>
        .
      </p>
      {operator ? (
        <p>
          <Link href="/shop/reseller" className="underline underline-offset-4">
            Reseller program coming soon.
          </Link>
        </p>
      ) : null}
      <p>
        How we use your name, email, and shipping address is on the{" "}
        <Link href="/shop/privacy" className="underline underline-offset-4">
          privacy page
        </Link>
        .
      </p>
    </PolicyArticle>
  );
}
