import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { ShopFrame } from "@/components/shop-frame";
import { HOW_WE_CHECK_HREF, REPLY_WITHIN_HOURS } from "@/lib/honest-price";
import { supportEmailForDisplay } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Contact · XV-AIsle" };

export default function ContactPage() {
  const supportEmail = supportEmailForDisplay();
  return (
    <ShopFrame>
      <article className="page-read">
        <p className="eyebrow">Store</p>
        <h1 className="page-title">Write the seller</h1>
        <p className="mt-2 text-base text-pretty text-foreground">
          Use this for a question, a return, or a late box. A real person replies within {REPLY_WITHIN_HOURS} hours. The
          note goes to the seller. You can also email{" "}
          <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
          .
        </p>
        <ContactForm />
        <p className="mt-8 text-sm">
          <Link href="/shop/returns" className="underline underline-offset-4">
            Returns
          </Link>
          {" · "}
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
          <Link href={HOW_WE_CHECK_HREF} className="underline underline-offset-4">
            How we check
          </Link>
        </p>
      </article>
    </ShopFrame>
  );
}
