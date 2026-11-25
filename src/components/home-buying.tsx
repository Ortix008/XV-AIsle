"use client";

import Image from "next/image";
import { MarkTile } from "@/components/mark-tile";
import { Reveal } from "@/components/reveal";
import { welcomeReach } from "@/lib/art";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

function hasCards(count: number) {
  return count > 0;
}

export function HomeBuying({ checkoutLine }: { checkoutLine: string }) {
  return (
    <>
      <section>
        <div className="mx-auto grid max-w-[1280px] gap-5 px-5 py-16 sm:px-10 sm:py-[72px] lg:grid-cols-3 lg:py-[110px]">
          <Reveal as="article" index={0} className="rounded-2xl border border-border bg-secondary p-7">
            <span className="mb-4 inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
            <h2 className="text-lg">Open product info</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Shipping details are added to each product once its supplier confirms them.
            </p>
          </Reveal>
          <Reveal as="article" index={1} className="rounded-2xl border border-border bg-secondary p-7">
            <span className="mb-4 inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
            <h2 className="text-lg">{RETURN_WINDOW_DAYS}-day returns</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Changed your mind? Start a return within {RETURN_WINDOW_DAYS} days of delivery.
            </p>
          </Reveal>
          <Reveal as="article" index={2} className="rounded-2xl border border-border bg-secondary p-7">
            <span className="mb-4 inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
            <p className="text-sm leading-relaxed text-muted-foreground">{checkoutLine}</p>
          </Reveal>
        </div>
      </section>

      {hasCards(welcomeReach.length) ? (
        <section className="border-t border-border">
          <div className="relative isolate min-h-[360px] overflow-hidden">
            <Image
              src="/brand/hero-warehouse-flow-green.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/55 to-black/30" />
            <Reveal className="relative z-10 mx-auto flex min-h-[360px] w-full max-w-[1280px] flex-col justify-end px-5 py-12 sm:px-10">
              <h2 className="text-4xl text-white sm:text-5xl">Who ships</h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90">Your order is sent straight to your door.</p>
            </Reveal>
          </div>
          <ul className="mx-auto grid max-w-[1280px] gap-5 px-5 py-8 sm:px-10 md:grid-cols-2">
            {welcomeReach.map((place, index) => (
              <Reveal key={place.title} as="li" index={index} className="product-card overflow-hidden rounded-2xl border border-border bg-card">
                <MarkTile src={place.src} alt="" sizes="(min-width: 768px) 50vw, 100vw" zoom />
                <div className="px-5 py-4">
                  <p className="font-heading text-lg">{place.title}</p>
                  <p className="mt-1 text-pretty text-sm text-muted-foreground">{place.line}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
