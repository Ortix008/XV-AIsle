import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";

export const metadata: Metadata = { title: "Shipping · XV-AIsle" };

export default function ShippingPage() {
  return (
    <PolicyArticle kicker="Store" title="Shipping">
      <p>We ship to addresses in the United States. Checkout will not take an order for another country.</p>
      <p>
        You pay on xvaisle.com. After the payment clears, the supplier ships the box. You do not pick it up from a
        store counter.
      </p>
      <p>
        A product page shows where the box ships from, and the delivery time, when the seller has filled those in. If
        they are blank, the page still shows the ship window in days. That window is an estimate. It is not a promise
        that the box arrives on a named day.
      </p>
      <p>
        If a box is late, missing, or not what you ordered,{" "}
        <Link href="/shop/contact" className="underline underline-offset-4">
          write the seller
        </Link>{" "}
        and include the order number. Returns are covered on the{" "}
        <Link href="/shop/returns" className="underline underline-offset-4">
          returns page
        </Link>
        .
      </p>
    </PolicyArticle>
  );
}
