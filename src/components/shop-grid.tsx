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

export function ShopGrid({
  kicker,
  title,
  lede,
  query,
  empty,
  limit,
  seeAllHref,
}: {
  kicker: string;
  title: string;
  lede: string;
  query: string;
  empty: string;
  limit?: number;
  seeAllHref?: string;
}) {
  const [listings, setListings] = useState<ShopCard[] | null>(null);

  useEffect(() => {
    fetch(`/api/store/listings${query}`)
      .then((response) => response.json())
      .then((data: { listings: ShopCard[] }) => setListings(data.listings ?? []))
      .catch(() => setListings([]));
  }, [query]);

  const visible = listings === null ? null : limit === undefined ? listings : listings.slice(0, limit);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{kicker}</p>
      <div className="mt-1 flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {seeAllHref ? (
          <Link href={seeAllHref} className="shrink-0 text-sm underline underline-offset-4">
            See all
          </Link>
        ) : null}
      </div>
      <p className="mt-2 max-w-xl text-pretty text-sm text-muted-foreground">{lede}</p>
      {visible === null ? <p className="mt-8 text-sm text-muted-foreground">Opening the store…</p> : null}
      {visible?.length === 0 ? <p className="mt-8 text-sm text-muted-foreground">{empty}</p> : null}
      <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visible?.map((listing) => (
          <li key={listing.productId}>
            <Link href={`/shop/${listing.productId}`} className="block">
              <div className="relative aspect-[4/3] bg-card">
                {listing.image ? (
                  <Image src={listing.image} alt="" fill sizes="320px" className="object-cover" />
                ) : null}
              </div>
              <p className="mt-2 text-sm font-medium">{listing.title}</p>
              {listing.sample ? <p className="text-xs font-medium">Sample</p> : null}
              {listing.madeInUsa ? <p className="text-xs font-medium">Made in the USA</p> : null}
              {listing.shelf === "small" ? <p className="text-xs text-muted-foreground">Small business</p> : null}
              <p className="text-sm text-muted-foreground">
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
