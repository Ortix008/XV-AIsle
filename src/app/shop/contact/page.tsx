import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { ShopFrame } from "@/components/shop-frame";
import { supportEmailForDisplay } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Contact · XV-AIsle" };

export default function ContactPage() {
  const supportEmail = supportEmailForDisplay();
  return (
    <ShopFrame>
      <article className="page-read">
        <p className="eyebrow">Store</p>
        <h1 className="page-title">{"We're here to help"}</h1>
        <p className="mt-2 text-base text-pretty text-foreground">
          Have a question about an order, a return or anything else? Reach out and a real person will get back to you.
        </p>
        <p className="mt-4 text-base">
          Email:{" "}
          <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
            {supportEmail}
          </a>
        </p>
        <p className="mt-4 text-base">Please include your order number so we can help faster.</p>
        <p className="mt-4 text-base">TODO: reply time is not confirmed yet.</p>
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
        </p>
      </article>
    </ShopFrame>
  );
}
