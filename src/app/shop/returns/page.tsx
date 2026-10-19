import type { Metadata } from "next";
import Link from "next/link";
import { PolicyArticle } from "@/components/policy-article";
import { supportEmailForDisplay } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Returns · XV-AIsle" };

export default function ReturnsPage() {
  const supportEmail = supportEmailForDisplay();
  return (
    <PolicyArticle band kicker="Store" title="Need to send something back?">
      <p>You have 14 days from delivery to start a return.</p>
      <p>
        {"Just email us and we'll help you start it. We'll email the return address when you start a return."}
      </p>
      <p>
        {"Please send items back in the condition they arrived. If a product can't be returned, its page will say so."}
      </p>
      <p>Return shipping is on you, unless your item arrived damaged, defective or wrong. Then it&apos;s on us.</p>
      <p>{"Some items have their own return rules, and you'll see them in a short note on that product's page."}</p>
      <p>
        {
          "Once the supplier confirms they have your item back, we'll refund the card you paid with. How fast it shows up depends on your bank. Stripe handles your card, so we never see your number."
        }
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
