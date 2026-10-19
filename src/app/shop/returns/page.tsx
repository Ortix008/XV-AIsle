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
        {"Just reach out to us and we'll help you start it. Returns go straight back to the company that shipped your item, and you'll find that address on your order page."}
      </p>
      <p>TODO: item condition rules, and anything that can&apos;t be returned, are not confirmed yet.</p>
      <p>Return shipping is on you, unless your item arrived damaged, defective or wrong. Then it&apos;s on us.</p>
      <p>{"Some items have their own return rules, and you'll see them in a short note on that product's page."}</p>
      <p>{"Once the supplier receives the item, we'll refund your original payment method."}</p>
      <p>{"Something arrived damaged or wrong? Send us a photo within 7 days and we'll make it right."}</p>
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
