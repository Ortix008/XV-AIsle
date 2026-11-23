"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ShopFooter } from "@/components/shop-footer";
import { StoreHeader } from "@/components/store-header";
import { NightStalls } from "@/components/night-stalls";
import { homeStepTiles } from "@/lib/home-aisles";
import type { NightWorldSlug } from "@/lib/night-worlds";
import { AisleParallax, XvAisleFlow } from "@/components/xvaisle-flow";
import { MarkTile } from "@/components/mark-tile";
import { ShopGrid, type ShopCard } from "@/components/shop-grid";
import { welcomeReach } from "@/lib/art";
import { HERO_EYEBROW } from "@/lib/hero-copy";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

/** Const lists have a fixed length type, so the empty check takes a number. */
function hasCards(count: number) {
  return count > 0;
}

export function JoinScreen({
  checkoutLine,
  operator = false,
  showPrices = false,
  showBuying = false,
  listings,
  nightSlugs = [],
}: {
  checkoutLine: string;
  operator?: boolean;
  showPrices?: boolean;
  /** Launch switch. The buying block under the aisle grid stays in source and is hidden while this is off. */
  showBuying?: boolean;
  listings?: ShopCard[];
  nightSlugs?: readonly NightWorldSlug[];
}) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#home-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <StoreHeader />
      <main id="home-main" className="page-enter">
        <section className="hero-aisle">
          <div className="hero-aisle-stage" aria-hidden>
            <AisleParallax>
              <picture>
                <source
                  media="(max-width: 767px)"
                  type="image/avif"
                  srcSet="/brand/hero-band-640.avif 640w, /brand/hero-band-800.avif 800w"
                  sizes="125vw"
                />
                <source
                  media="(max-width: 767px)"
                  type="image/webp"
                  srcSet="/brand/hero-band-640.webp 640w, /brand/hero-band-800.webp 800w"
                  sizes="125vw"
                />
                <img
                  src="/brand/hero-aisle-pedestals.webp"
                  alt=""
                  width={1280}
                  height={720}
                  fetchPriority="high"
                  decoding="async"
                  className="hero-aisle-photo"
                />
              </picture>
            </AisleParallax>
            <div className="hero-aisle-grade" />
            <XvAisleFlow />
            <div className="hero-aisle-scrim" />
          </div>
          <div className="hero-aisle-inner relative z-[1] mx-auto flex min-h-[inherit] max-w-[1280px] flex-col justify-center px-5 py-16 sm:px-10 lg:py-24">
            <div className="hero-glow" aria-hidden />
            <div className="hero-text-scrim" aria-hidden />
            <div className="relative z-[1] max-w-xl">
              <p className="eyebrow hero-eyebrow">{HERO_EYEBROW}</p>
              <h1 className="mt-5 text-[3.25rem] leading-[0.95] font-bold tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
                <span className="hero-break">Goods that </span>earn their <span className="text-primary">place.</span>
              </h1>
              <p className="hero-lede mt-7 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                Each pick links to the store where you buy it.
              </p>
              <div className="hero-actions">
                <Link href={(listings?.length ?? 0) > 0 ? "/shop" : "/aisles"} className="pill pill-primary">
                  Browse the aisles
                </Link>
                {operator ? (
                  <Link href="/shop/reseller" className="status-chip">
                    Reseller program coming soon.
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section id="aisles" className="scroll-mt-24">
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10 sm:py-[72px] lg:py-[110px]">
            {nightSlugs.length > 0 ? (
              <>
                <Reveal className="mb-10 flex items-end justify-between gap-5">
                  <div>
                    <p className="eyebrow">Aisles</p>
                    <h2 className="mt-3 text-4xl sm:text-5xl lg:text-[52px]">Our aisles</h2>
                    <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground">
                      {"Each one has its own glow. Here's what you'll find inside."}
                    </p>
                  </div>
                  <Link
                    href={(listings?.length ?? 0) > 0 ? "/shop" : "/aisles"}
                    className="link-slide shrink-0 text-sm text-muted-foreground hover:text-primary"
                  >
                    View all →
                  </Link>
                </Reveal>
                <NightStalls slugs={nightSlugs} />
              </>
            ) : null}
            <div className={nightSlugs.length > 0 ? "home-aisles mt-16" : "home-aisles"}>
              <h2 className="home-aisles-head text-3xl sm:text-4xl">Step into an aisle.</h2>
              <ul className="affiliate-index">
                {homeStepTiles().map((tile, index) => (
                  <Reveal as="li" key={tile.href} index={index} pace="shop">
                    <Link href={tile.href} className="affiliate-tile">
                      <span className="affiliate-tile-art">
                        {/* Plain img so the 800px still ships as is. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={tile.src} alt="" width={800} height={800} loading="lazy" decoding="async" />
                      </span>
                      <span className="affiliate-tile-copy">
                        <h3 className="affiliate-card-name">{tile.name}</h3>
                        <p className="affiliate-blurb affiliate-tile-intro">{tile.intro}</p>
                      </span>
                    </Link>
                  </Reveal>
                ))}
              </ul>
              <Link href="/aisles" className="pill pill-ghost home-aisles-more">
                See all aisles
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                  <path
                    d="M6 3.5 10.5 8 6 12.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        <ShopGrid
          kicker="Featured"
          title="In the store"
          lede="Prices, shipping and returns are set by the store you buy from."
          query=""
          empty="Nothing's on the shelves yet. We're picking the first pieces now."
          limit={4}
          seeAllHref="/shop"
          level="section"
          hideWhenEmpty
          band
          photosOnly
          showPrices={showPrices}
          initialListings={listings}
        />

        {showBuying ? (
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
                    <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90">
                      Your order is sent straight to your door.
                    </p>
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
        ) : null}
      </main>
      <ShopFooter showReseller={operator} />
    </div>
  );
}
