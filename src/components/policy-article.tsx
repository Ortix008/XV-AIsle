import Link from "next/link";
import type { ReactNode } from "react";
import { AisleHero } from "@/components/aisle-hero";
import { Reveal } from "@/components/reveal";
import { ShopFrame } from "@/components/shop-frame";
import { HOW_WE_CHECK_HREF } from "@/lib/honest-price";
import { supportEmailForDisplay } from "@/lib/server/settings";

export function PolicyArticle({
  kicker,
  title,
  children,
  story = false,
  underHero,
  band = false,
  operator = false,
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  story?: boolean;
  underHero?: ReactNode;
  band?: boolean;
  operator?: boolean;
}) {
  const supportEmail = supportEmailForDisplay();
  const contact = (sectionClass: string) => (
    <section className={sectionClass}>
      <h2 className="text-lg font-semibold">Contact</h2>
      <p>
        Email{" "}
        <a className="tap-link underline underline-offset-4" href={`mailto:${supportEmail}`}>
          {supportEmail}
        </a>
        .
      </p>
      <p>
        {operator ? "We'll email the return address when you start a return. " : null}
        Contact support to start a return.
      </p>
    </section>
  );
  if (band) {
    return (
      <ShopFrame>
        <div className="policy-shell">
          <header className="policy-band">
            <div className="shop-band-art" aria-hidden />
            <div className="policy-band-copy">
              <p className="eyebrow">{kicker}</p>
            </div>
          </header>
          <Reveal as="article" className="policy-card">
            <h1 className="page-title">{title}</h1>
            <div className="policy-copy">{children}</div>
            <p className="policy-more">
              <Link href={HOW_WE_CHECK_HREF} className="tap-link underline underline-offset-4">
                How we check
              </Link>
            </p>
            {contact("policy-contact")}
          </Reveal>
        </div>
      </ShopFrame>
    );
  }
  return (
    <ShopFrame>
      {story ? <AisleHero kicker={kicker} title={title} /> : null}
      {underHero}
      <Reveal as="article" className={story ? "page-read story-copy" : "page-read"}>
        {story ? null : (
          <>
            <p className="eyebrow">{kicker}</p>
            <h1 className="page-title">{title}</h1>
          </>
        )}
        <div className={story ? "space-y-4 text-base leading-relaxed text-foreground" : "mt-8 space-y-4 text-base leading-relaxed text-foreground"}>{children}</div>
        <p className="mt-6">
          <Link href={HOW_WE_CHECK_HREF} className="tap-link underline underline-offset-4">
            How we check
          </Link>
        </p>
        {contact("mt-10 space-y-3 border-t border-border pt-6 text-base leading-relaxed")}
      </Reveal>
    </ShopFrame>
  );
}
