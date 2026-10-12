"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/money";

export type ShopCard = {
  productId: string;
  title: string;
  priceCents: number;
  image: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  madeInUsa?: boolean;
  shelf?: string;
  sample?: boolean;
};

function eyebrow(listing: ShopCard) {
  if (listing.sample) return "Sample";
  if (listing.madeInUsa) return "Made in the USA";
  if (listing.shelf === "small") return "Small business";
  return listing.supplierOrigin;
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
}: {
  kicker: string;
  title: string;
  lede: string;
  query: string;
  empty: string;
  limit?: number;
  seeAllHref?: string;
  level?: "page" | "section";
}) {
  const [listings, setListings] = useState<ShopCard[] | null>(null);

  useEffect(() => {
    fetch(`/api/store/listings${query}`)
      .then((response) => response.json())
      .then((data: { listings: ShopCard[] }) => setListings(data.listings ?? []))
      .catch(() => setListings([]));
  }, [query]);

  const visible = listings === null ? null : limit === undefined ? listings : listings.slice(0, limit);
  const Heading = level === "page" ? "h1" : "h2";

  return (
    <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10 sm:py-[72px] lg:py-[110px]">
      <div className="reveal mb-10 flex items-end justify-between gap-5">
        <div>
          <p className="eyebrow">{kicker}</p>
          <Heading className="mt-3 text-4xl sm:text-5xl lg:text-[52px]">{title}</Heading>
          <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground">{lede}</p>
        </div>
        {seeAllHref ? (
          <Link href={seeAllHref} className="shrink-0 text-sm text-muted-foreground hover:text-primary">
            Shop all →
          </Link>
        ) : null}
      </div>
      {visible === null ? <p className="text-sm text-muted-foreground">Opening the store…</p> : null}
      {visible?.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {visible?.map((listing) => (
          <li key={listing.productId} className="reveal">
            <Link
              href={`/shop/${listing.productId}`}
              className="store-card block rounded-2xl border border-border bg-card p-2 sm:p-3"
            >
              <div className="media-well relative aspect-[4/5] overflow-hidden rounded-[14px] border border-border">
                {listing.image ? (
                  <Image
                    src={listing.image}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 280px, 50vw"
                    className="media-zoom object-cover"
                  />
                ) : null}
              </div>
              <p className="mt-4 px-1 font-heading text-xs tracking-[0.14em] text-muted-foreground uppercase">
                {eyebrow(listing)}
              </p>
              <h3 className="mt-1 px-1 text-[15px] font-semibold tracking-[-0.01em] sm:text-[17px]">{listing.title}</h3>
              <p className="mt-1 px-1 pb-1 text-sm text-muted-foreground">
                {money(listing.priceCents / 100)} · ships from {listing.supplierOrigin} in {listing.shipDaysMin}–
                {listing.shipDaysMax} days
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
