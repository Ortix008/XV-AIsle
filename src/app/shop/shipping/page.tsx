import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";

export const metadata: Metadata = { title: "Shipping · XV-AIsle" };

export default function ShippingPage() {
  return (
    <PolicyArticle kicker="Store" title="Shipping, plain and simple">
      <p>For now we ship only within the United States, so checkout only accepts US addresses.</p>
      <p>Once your payment goes through, the supplier ships it straight to your door.</p>
      <p>Every product page shows that item&apos;s own shipping window.</p>
      <p>{"That window is our best estimate, so we can't promise a specific delivery day."}</p>
      <p>{"Once your order is on its way, we'll email you tracking."}</p>
      <p>
        {
          "If something's running late, we'll let you know before the date we gave you. You can wait a little longer or cancel for a full refund."
        }
      </p>
      <p>Questions? Just reach out and a real person will help.</p>
      <p>
        <Link href="/shop/contact" className="underline underline-offset-4">
          Contact
        </Link>
        {" · "}
        <Link href="/shop/returns" className="underline underline-offset-4">
          Returns
        </Link>
      </p>
    </PolicyArticle>
  );
}
