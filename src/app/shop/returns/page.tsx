import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";
import { storeReturnCopy } from "@/lib/server/supplier-returns";

export const metadata: Metadata = { title: "Returns · XV-AIsle" };

export default function ReturnsPage() {
  return (
    <PolicyArticle kicker="Store" title="Returns and refunds">
      <p>
        You can start a return within {RETURN_WINDOW_DAYS} days of delivery. Include your order number when you write.
      </p>
      <p>{storeReturnCopy()}</p>
      <p>
        After the return is accepted, the refund goes back to the original payment method. Stripe processes the card.
        We do not see your card number.
      </p>
      <p>
        <Link href="/shop/shipping" className="underline underline-offset-4">
          Shipping
        </Link>
        {" · "}
        <Link href="/shop/terms" className="underline underline-offset-4">
          Terms
        </Link>
        {" · "}
        <Link href="/shop/privacy" className="underline underline-offset-4">
          Privacy
        </Link>
        {" · "}
        <Link href="/shop/contact" className="underline underline-offset-4">
          Contact
        </Link>
      </p>
    </PolicyArticle>
  );
}
