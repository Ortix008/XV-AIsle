"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Reveal } from "@/components/reveal";
import { ShopFooter } from "@/components/shop-footer";
import { homeStepTiles } from "@/lib/home-aisles";
import type { NightWorldSlug } from "@/lib/night-worlds";
import type { ShopCard } from "@/components/shop-grid";

const NightStalls = dynamic(() => import("@/components/night-stalls").then((mod) => mod.NightStalls));
const ShopGrid = dynamic(() => import("@/components/shop-grid").then((mod) => mod.ShopGrid));
const HomeBuying = dynamic(() => import("@/components/home-buying").then((mod) => mod.HomeBuying));

export function HomeBelow({
  checkoutLine,
  operator = false,
  showPrices = false,
  showBuying = false,
  listings,
  nightSlugs = [],
  lede,
}: {
  checkoutLine: string;
  operator?: boolean;
  showPrices?: boolean;
  showBuying?: boolean;
  listings?: ShopCard[];
  nightSlugs?: readonly NightWorldSlug[];
  lede: string;
}) {
  return (
    <>
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
          lede={lede}
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

        {showBuying ? <HomeBuying checkoutLine={checkoutLine} /> : null}
      <ShopFooter showReseller={operator} />
    </>
  );
}
