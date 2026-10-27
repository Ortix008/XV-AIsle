import Link from "next/link";
import type { CSSProperties } from "react";
import { ProductFrame } from "@/components/product-frame";
import { money } from "@/lib/money";
import { SOLD_OUT_LABEL } from "@/lib/sold-out-label";
import { nightWorldForListing, nightWorldVars } from "@/lib/night-worlds";

export type AislePick = {
  productId: string;
  title: string;
  priceCents: number;
  image: string;
  aisle?: string | null;
  kind?: "bundle";
  soldOut?: boolean;
};

export function AislePicks({ aisle, picks }: { aisle: string | null; picks: AislePick[] }) {
  if (!aisle) return null;
  if (picks.length === 0) {
    return (
      <p className="mx-auto max-w-[1280px] px-5 pb-10 sm:px-10">
        <Link href={`/shop?aisle=${encodeURIComponent(aisle)}`} className="text-sm text-primary underline underline-offset-4">
          Browse the aisle
        </Link>
      </p>
    );
  }
  return (
    <section className="mx-auto max-w-[1280px] px-5 pt-2 pb-14 sm:px-10">
      <h2 className="text-2xl">More from this aisle</h2>
      <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {picks.map((pick) => {
          const world = nightWorldForListing(pick);
          return (
            <li key={pick.productId}>
              <Link
                href={`/shop/${pick.productId}`}
                data-world={world?.slug}
                style={world ? (nightWorldVars(world) as CSSProperties) : undefined}
                className="product-card block h-full rounded-2xl border border-border bg-card p-2"
              >
                <ProductFrame src={pick.image} alt="" sizes="(min-width: 1024px) 240px, 50vw" />
                <div className="shop-card-text">
                  <p className="shop-card-eyebrow" aria-hidden />
                  <h3 className="shop-card-title">{pick.title}</h3>
                  <p className="shop-card-price">{money(pick.priceCents / 100)}</p>
                  {pick.soldOut ? <p className="shop-card-price">{SOLD_OUT_LABEL}</p> : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
