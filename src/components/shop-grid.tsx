"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { NightMotif } from "@/components/night-motif";
import { ProductFrame } from "@/components/product-frame";
import { Reveal } from "@/components/reveal";
import { aisleCardArt } from "@/lib/art";
import { money } from "@/lib/money";
import { SOLD_OUT_LABEL } from "@/lib/sold-out-label";
import { nightWorlds, nightWorldVars, type NightWorld } from "@/lib/night-worlds";
import { SHOP_CARD_STATUS, shopCardShowsPrice, showShopPrices } from "@/lib/shop-prices";
import { hasRealProductPhoto } from "@/lib/shop-photo";
import { productIsPackshot } from "@/lib/shop-packshot";

export type ShopCard = {
  productId: string;
  title: string;
  priceCents?: number;
  image: string;
  supplierName?: string;
  supplierOrigin?: string;
  shipsFrom?: string | null;
  supplierUsConfirmed?: boolean;
  shipDaysMin?: number;
  shipDaysMax?: number;
  madeInUsa?: boolean;
  shelf?: string;
  sample?: boolean;
  brand?: string;
  kind?: "bundle";
  aisle?: string | null;
  soldOut?: boolean;
  packshot?: boolean | null;
};

function eyebrow(listing: ShopCard) {
  if (listing.kind === "bundle") return "Bundle";
  if (listing.brand) return listing.brand;
  if (listing.sample) return "Sample";
  if (listing.shelf === "small") return "Small business";
  return "";
}

export function ShopCardCopy({ listing, showPrices = false }: { listing: ShopCard; showPrices?: boolean }) {
  const label = eyebrow(listing);
  return (
    <div className="shop-card-text">
      {label ? <p className="shop-card-eyebrow">{label}</p> : null}
      <h3 className="shop-card-title">{listing.title}</h3>
      <p className="shop-card-price">
        {shopCardShowsPrice(listing.priceCents, showPrices) ? money((listing.priceCents ?? 0) / 100) : SHOP_CARD_STATUS}
      </p>
      {listing.soldOut ? <p className="shop-card-price">{SOLD_OUT_LABEL}</p> : null}
    </div>
  );
}

export function ShopGrid({
  kicker,
  title,
  lede,
  query,
  empty,
  limit,
  seeAllHref,
  level = "page",
  world = null,
  catalog = false,
  hideWhenEmpty = false,
  band = false,
  initialListings,
  stalls,
  showPrices,
  photosOnly = false,
}: {
  kicker: string;
  title: string;
  lede: string;
  query: string;
  empty: string;
  limit?: number;
  seeAllHref?: string;
  level?: "page" | "section";
  world?: NightWorld | null;
  catalog?: boolean;
  hideWhenEmpty?: boolean;
  band?: boolean;
  /** Server-rendered cards. When set, the grid does not swap out of a loading panel. */
  initialListings?: ShopCard[];
  stalls?: readonly NightWorld[];
  showPrices?: boolean;
  /** Home and other shopper grids use the same photo rule as the shop. */
  photosOnly?: boolean;
}) {
  const pricesOn = showPrices ?? showShopPrices();
  const hidePlainPhotos = catalog || photosOnly;
  const bandRef = useRef<HTMLElement>(null);
  const [fetched, setFetched] = useState<ShopCard[] | null>(null);
  const listings = initialListings ?? fetched;

  useEffect(() => {
    if (initialListings) return;
    let ignore = false;
    fetch(`/api/store/listings${query}`)
      .then((response) => response.json())
      .then((data: { listings: ShopCard[] }) => {
        if (!ignore) setFetched(data.listings ?? []);
      })
      .catch(() => {
        if (!ignore) setFetched([]);
      });
    return () => {
      ignore = true;
    };
  }, [query, initialListings]);

  useEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) band.classList.toggle("is-drifting", entry.isIntersecting);
      },
      { threshold: 0 },
    );
    watcher.observe(band);
    return () => watcher.disconnect();
  }, [catalog]);

  const withPhotos =
    listings === null ? null : hidePlainPhotos ? listings.filter((item) => hasRealProductPhoto(item.image)) : listings;
  const visible = withPhotos === null ? null : limit === undefined ? withPhotos : withPhotos.slice(0, limit);
  const Heading = level === "page" ? "h1" : "h2";
  if (hideWhenEmpty && (visible === null || visible.length === 0)) return null;

  const grid = (
    <div className={catalog ? "shop-catalog" : "mx-auto max-w-[1280px] px-5 py-16 sm:px-10 sm:py-[72px] lg:py-[110px]"}>
      {catalog ? (
        <>
          <header ref={bandRef} className="shop-band">
            <div className="shop-band-art" aria-hidden />
            <div className="shop-band-wash" aria-hidden />
            <div className="shop-band-copy">
              <p className="eyebrow">Store</p>
              <Heading className="page-title">{title}</Heading>
              <p className="mt-3 max-w-xl text-pretty text-base text-muted-foreground">
                {world ? world.story : lede}
              </p>
            </div>
          </header>
          <ul className="stall-tabs">
            {(stalls ?? nightWorlds).map((stall, index) => {
              const current = world?.slug === stall.slug;
              return (
                <Reveal key={stall.slug} as="li" index={index} pace="shop">
                  <Link
                    href={`/shop?aisle=${stall.slug}`}
                    aria-current={current ? "page" : undefined}
                    className="stall-tab"
                    style={nightWorldVars(stall) as CSSProperties}
                  >
                    <span className="stall-tab-art">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={aisleCardArt[stall.slug]}
                        alt=""
                        width={1280}
                        height={720}
                        className={stall.slug === "everyday-finds" ? "object-everyday" : undefined}
                      />
                      <span className="stall-tab-chip" aria-hidden="true">
                        <NightMotif slug={stall.slug} />
                      </span>
                    </span>
                    <span className="stall-tab-title">{stall.title}</span>
                    <span className="stall-tab-story">{stall.story}</span>
                  </Link>
                </Reveal>
              );
            })}
          </ul>
        </>
      ) : null}
      {catalog ? null : world ? (
        <Reveal>
          <div className="stall-mast" style={nightWorldVars(world) as CSSProperties}>
            <NightMotif slug={world.slug} />
            <div>
              <p className="eyebrow" style={{ color: world.accent }}>
                {kicker}
              </p>
              <Heading className="mt-3 text-4xl sm:text-5xl lg:text-[52px]">{title}</Heading>
              <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground">{lede}</p>
            </div>
          </div>
        </Reveal>
      ) : (
        <Reveal className="mb-10 flex items-end justify-between gap-5">
          <div>
            <p className="eyebrow">{kicker}</p>
            <Heading className="mt-3 text-4xl sm:text-5xl lg:text-[52px]">{title}</Heading>
            <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground">{lede}</p>
          </div>
          {seeAllHref ? (
            <Link href={seeAllHref} className="link-slide shrink-0 text-sm text-muted-foreground hover:text-primary">
              Shop all →
            </Link>
          ) : null}
        </Reveal>
      )}
      {visible === null ? (
        <div className="empty-panel">
          <p className="eyebrow">Store</p>
          <p className="mt-3 text-2xl">Opening the store…</p>
        </div>
      ) : null}
      {visible?.length === 0 ? (
        catalog ? (
          <div className="shop-empty">
            <div className="shop-empty-art" aria-hidden />
            <div className="shop-empty-copy">
              <p className="eyebrow">Aisle</p>
              <p className="mt-3 text-2xl sm:text-3xl">New finds landing soon</p>
              <p className="mt-3 max-w-md text-base text-muted-foreground">{empty}</p>
              <Link href="/shop" className="link-slide mt-5 inline-block text-sm text-primary">
                All aisles
              </Link>
            </div>
          </div>
        ) : (
          <div className="empty-panel">
            <p className="eyebrow">Empty</p>
            <p className="mt-3 text-2xl">{empty}</p>
          </div>
        )
      ) : null}
      <ul className={catalog ? "shop-fill" : "grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4"}>
        {visible?.map((listing, index) => {
          return (
            <Reveal key={listing.productId} as="li" index={index} pace={catalog ? "shop" : "page"}>
              <Link href={`/shop/${listing.productId}`} className="product-card block border border-border bg-card p-2 sm:p-3">
                <ProductFrame
                  src={listing.image}
                  alt={listing.title}
                  sizes="(min-width: 1024px) 280px, 50vw"
                  zoom
                  packshot={productIsPackshot(listing.productId, listing)}
                  loading={catalog && index < 3 ? "eager" : "lazy"}
                  fetchPriority={catalog && index === 0 ? "high" : undefined}
                />
                <ShopCardCopy listing={listing} showPrices={pricesOn} />
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </div>
  );
  if (!band) return grid;
  return <section className="border-y border-border bg-secondary">{grid}</section>;
}
