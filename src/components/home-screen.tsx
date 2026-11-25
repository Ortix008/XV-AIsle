"use client";

import Link from "next/link";
import { HomeBelow } from "@/components/home-below";
import { StoreHeader } from "@/components/store-header";
import type { NightWorldSlug } from "@/lib/night-worlds";
import { AisleParallax, XvAisleFlow } from "@/components/xvaisle-flow";
import type { ShopCard } from "@/components/shop-grid";
import { HERO_EYEBROW } from "@/lib/hero-copy";
import type { ReactNode } from "react";

export function JoinScreen({
  checkoutLine,
  operator = false,
  showPrices = false,
  showBuying = false,
  listings,
  nightSlugs = [],
  children,
}: {
  checkoutLine: string;
  operator?: boolean;
  showPrices?: boolean;
  /** Launch switch. The buying block under the aisle grid stays in source and is hidden while this is off. */
  showBuying?: boolean;
  listings?: ShopCard[];
  nightSlugs?: readonly NightWorldSlug[];
  children?: ReactNode;
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

        {children}

        <HomeBelow
          checkoutLine={checkoutLine}
          operator={operator}
          showPrices={showPrices}
          showBuying={showBuying}
          listings={listings}
          nightSlugs={nightSlugs}
          lede="Prices, shipping and returns are set by the store you buy from."
        />
      </main>
      </div>
  );
}
