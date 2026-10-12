import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { DELIVERY_WARN_BUSINESS_DAYS, REPLY_WITHIN_HOURS } from "@/lib/honest-price";

export const metadata: Metadata = { title: "How we check · XV-AIsle" };

export default function HowWeCheckPage() {
  return (
    <PolicyArticle kicker="Store" title="How we check">
      <p>A listing shows one price. That is the price you pay on xvaisle.com. There is no second price beside it.</p>
      <p>
        We do not publish fake discounts, countdown timers, spin wheels, or made-up stock counts. A compare-at price or a
        crossed-out price is refused before it can reach the store.
      </p>
      <p>
        When a listing is checked, the product page can say who at XV looked at it, the date, and what we noticed. That
        note appears only after it is written. An empty check is not shown.
      </p>
      <p>
        If the promised delivery is longer than {DELIVERY_WARN_BUSINESS_DAYS} business days, the desk warns the operator
        before the page stays up.
      </p>
      <p>
        A real person replies to a shopper note within {REPLY_WITHIN_HOURS} hours. Write from the{" "}
        <Link href="/shop/contact" className="underline underline-offset-4">
          contact page
        </Link>
        .
      </p>
    </PolicyArticle>
  );
}
