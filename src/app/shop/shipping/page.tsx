import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";

export const metadata: Metadata = { title: "Shipping · XV-AIsle" };

export default function ShippingPage() {
  return (
    <PolicyArticle kicker="Store" title="Shipping, plain and simple">
      <p>For now we ship only to US addresses.</p>
      <p>Each item comes straight from the company that makes it, so items in one order may arrive in separate boxes.</p>
      <p>Every product page shows that item&apos;s own shipping window.</p>
      <p>TODO: each supplier still has to confirm that item&apos;s shipping window. There is no store-wide number yet.</p>
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
