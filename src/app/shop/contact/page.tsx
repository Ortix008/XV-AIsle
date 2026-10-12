import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/contact-form";
import { ShopFrame } from "@/components/shop-frame";
import { isSupportEmail, readSupportEmail } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Contact · XV-AIsle" };

export default function ContactPage() {
  const storedEmail = readSupportEmail();
  const supportEmail = isSupportEmail(storedEmail) ? storedEmail : "";
  return (
    <ShopFrame>
      <article className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Store</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Write the seller</h1>
        <p className="mt-2 text-base text-pretty text-foreground">
          Use this for a question, a return, or a late box. The note goes to the seller.
          {supportEmail ? (
            <>
              {" "}
              You can also email{" "}
              <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </>
          ) : (
            " A support email is not published yet."
          )}
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
        </p>
      </article>
    </ShopFrame>
  );
}
