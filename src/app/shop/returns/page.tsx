import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { supportEmailForDisplay } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Returns · XV-AIsle" };

export default function ReturnsPage() {
  const supportEmail = supportEmailForDisplay();
  return (
    <PolicyArticle kicker="Store" title="Need to send something back?">
      <p>You have 14 days from delivery to start a return.</p>
      <p>
        {"Just reach out to us and we'll help you start it. We'll email the return address when you start a return."}
      </p>
      <p>
        Unused, in original packaging. Damaged, defective or wrong items: send a photo within 7 days of delivery and we
        cover return shipping.
      </p>
      <p>Return shipping is on you, unless your item arrived damaged, defective or wrong. Then it&apos;s on us.</p>
      <p>{"Some items have their own return rules, and you'll see them in a short note on that product's page."}</p>
      <p>{"Once your return arrives back, we'll refund the card you paid with."}</p>
      <p>
        Once we accept your return, the refund goes back to the card you paid with. Stripe handles the card, so we never
        see your number.
      </p>
      <p>{"Something arrived damaged or wrong? Send us a photo within 7 days of delivery and we'll help make it right."}</p>
      <p>
        Email{" "}
        <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        .
      </p>
      <p>
        <Link href="/shop/shipping" className="underline underline-offset-4">
          Shipping
        </Link>
        {" · "}
        <Link href="/shop/contact" className="underline underline-offset-4">
          Contact
        </Link>
      </p>
    </PolicyArticle>
  );
}
