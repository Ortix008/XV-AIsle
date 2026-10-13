import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { RESELLER_DISCLOSURE, RETURN_WINDOW_DAYS } from "@/lib/policies";

export const metadata: Metadata = { title: "Terms · XV-AIsle" };

export default function TermsPage() {
  return (
    <PolicyArticle kicker="Store" title="Terms of sale">
      <p>
        These terms cover a purchase on xvaisle.com. The price is the price on the product page. You pay that price on
        this site. Stripe processes the card. We do not see your card number.
      </p>
      <p>Orders ship to United States addresses. The supplier sends the box after payment clears.</p>
      <p>
        You can start a return within {RETURN_WINDOW_DAYS} days of delivery. The{" "}
        <Link href="/shop/returns" className="underline underline-offset-4">
          returns page
        </Link>{" "}
        explains how. Shipping times are described on the{" "}
        <Link href="/shop/shipping" className="underline underline-offset-4">
          shipping page
        </Link>
        .
      </p>
      <p>
        An independent reseller may share a product. Commission is paid only when a real sale is completed. We do not
        promise that anyone will earn money. A public mention of a product has to say{" "}
        <span className="font-medium">{RESELLER_DISCLOSURE}</span> Read the{" "}
        <Link href="/shop/reseller" className="underline underline-offset-4">
          reseller program
        </Link>{" "}
        and the{" "}
        <Link href="/shop/reseller/terms" className="underline underline-offset-4">
          reseller terms
        </Link>
        .
      </p>
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
