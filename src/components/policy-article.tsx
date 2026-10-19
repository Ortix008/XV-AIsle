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
}: {
  kicker: string;
  title: string;
  children: ReactNode;
  story?: boolean;
  underHero?: ReactNode;
}) {
  const supportEmail = supportEmailForDisplay();
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
          <Link href={HOW_WE_CHECK_HREF} className="underline underline-offset-4">
            How we check
          </Link>
        </p>
        <section className="mt-10 space-y-3 border-t border-border pt-6 text-base leading-relaxed">
          <h2 className="text-lg font-semibold">Contact</h2>
          <p>
            Email{" "}
            <a className="underline underline-offset-4" href={`mailto:${supportEmail}`}>
              {supportEmail}
            </a>
            .
          </p>
          <p>{"We'll email the return address when you start a return. Contact support to start a return."}</p>
        </section>
      </Reveal>
    </ShopFrame>
  );
}
