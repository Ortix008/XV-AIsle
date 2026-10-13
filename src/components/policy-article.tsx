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
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{kicker}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-6 space-y-4 text-base leading-relaxed text-foreground">{children}</div>
        <section className="mt-8 space-y-3 border-t pt-6 text-base leading-relaxed">
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
