import Link from "next/link";
import type { ReactNode } from "react";
import { ShopFrame } from "@/components/shop-frame";
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
      <article className="mx-auto max-w-2xl px-5 py-16 sm:px-10 sm:py-24">
        <p className="eyebrow">{kicker}</p>
        <h1 className="mt-4 text-4xl sm:text-5xl">{title}</h1>
        <div className="mt-8 space-y-4 text-base leading-relaxed text-foreground">{children}</div>
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
      </article>
    </ShopFrame>
  );
}
