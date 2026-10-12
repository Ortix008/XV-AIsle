import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/reveal";
import { ShopFrame } from "@/components/shop-frame";
import { HOW_WE_CHECK_HREF } from "@/lib/honest-price";
import { isSupportEmail, readReturnsAddress, readSupportEmail } from "@/lib/server/settings";

export function PolicyArticle({
  kicker,
  title,
  children,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
}) {
  const returns = readReturnsAddress();
  const storedEmail = readSupportEmail();
  const supportEmail = isSupportEmail(storedEmail) ? storedEmail : "";
  return (
    <ShopFrame>
      <Reveal as="article" className="page-read">
        <p className="eyebrow">{kicker}</p>
        <h1 className="page-title">{title}</h1>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">{children}</div>
        <p className="mt-6">
          <Link href={HOW_WE_CHECK_HREF} className="underline underline-offset-4">
            How we check
          </Link>
        </p>
        <section className="mt-10 space-y-3 border-t border-border pt-6 text-base leading-relaxed">
          <h2 className="text-lg font-semibold">Contact</h2>
          {supportEmail ? (
            <p>
              Email{" "}
              <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
                {supportEmail}
              </a>
              .
            </p>
          ) : (
            <p>
              A support email is not published yet.{" "}
              <Link href="/shop/contact" className="underline underline-offset-4">
                Write the seller
              </Link>
              .
            </p>
          )}
          {returns ? (
            <p>
              Send a return to <span className="font-medium">{returns}</span>.
            </p>
          ) : (
            <p>A return address is not published yet. Start a return and the seller will send the address.</p>
          )}
        </section>
      </Reveal>
    </ShopFrame>
  );
}
