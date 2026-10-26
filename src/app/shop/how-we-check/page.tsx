import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { viewerIsOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = { title: "How we check · XV-AIsle" };

export default async function HowWeCheckPage() {
  return (
    <PolicyArticle kicker="Store" title="How we check" story operator={await viewerIsOperator()}>
      <p>A listing shows one price. That is the price you pay on xvaisle.com. There is no second price beside it.</p>
      <p>
        We do not publish fake discounts, countdown timers, spin wheels, or made-up stock counts. A compare-at price or a
        crossed-out price is refused before it can reach the store.
      </p>
      <p>
        When a listing is checked, the product page can say who at XV looked at it, the date, and what we noticed. That
        note appears only after it is written. An empty check is not shown.
      </p>
      <p>{"If your order hasn't shipped within 7 business days, we'll email you with an update and your options."}</p>
      <p>
        A real person replies within 2 business days. Write from the{" "}
        <Link href="/shop/contact" className="underline underline-offset-4">
          contact page
        </Link>
        .
      </p>
    </PolicyArticle>
  );
}
