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
      <div className="policy-shell">
        <header className="policy-band">
          <div className="shop-band-art" aria-hidden />
          <div className="policy-band-copy">
            <p className="eyebrow">Store</p>
          </div>
        </header>
        <article className="policy-card">
          <h1 className="page-title contact-title">{"We're here to help"}</h1>
          <div className="policy-copy">
            <p>Have a question about an order, a return or anything else? Reach out and a real person will get back to you.</p>
            <p>
              Email:{" "}
              <a className="tap-link underline underline-offset-4" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
            </p>
            <p>Please include your order number so we can help faster.</p>
            <p>We reply within 2 business days.</p>
          </div>
          <ContactForm />
          <p className="policy-more">
            <Link href="/shop/returns" className="tap-link underline underline-offset-4">
              Returns
            </Link>
            {" · "}
            <Link href="/shop/shipping" className="tap-link underline underline-offset-4">
              Shipping
            </Link>
            {" · "}
            <Link href="/shop/terms" className="tap-link underline underline-offset-4">
              Terms
            </Link>
            {" · "}
            <Link href="/shop/privacy" className="tap-link underline underline-offset-4">
              Privacy
            </Link>
          </p>
        </article>
      </div>
    </ShopFrame>
  );
}
