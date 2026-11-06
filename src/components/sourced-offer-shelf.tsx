"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { money } from "@/lib/money";
import type { PublicSourcedOffer } from "@/lib/offer-sale";

export function SourcedOfferList({ offers }: { offers: PublicSourcedOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-10 sm:px-10" aria-label="Sourcing notes">
      <p className="eyebrow">Sourcing</p>
      <h2 className="mt-3 text-3xl sm:text-4xl">Sourcing notes</h2>
      <ul className="mt-6 grid grid-cols-1 gap-3">
        {offers.map((offer) => (
          <li key={offer.id} className="border border-border bg-card p-4 sm:p-5">
            <h3 className="text-lg">{offer.title}</h3>
            {offer.variants.length > 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {offer.variants.map((item) => `${item.label} ${item.code}`).join(" · ")}
              </p>
            ) : null}
            {offer.sourceRetailCents != null ? (
              <p className="mt-2 text-sm">Source retail reference {money(offer.sourceRetailCents / 100)}. Not our price.</p>
            ) : null}
            {offer.note ? <p className="mt-2 text-sm text-muted-foreground">{offer.note}</p> : null}
            {offer.label ? (
              <p className="mt-3 text-sm font-medium" role="status">
                {offer.label}
              </p>
            ) : null}
            {offer.citations.length > 0 ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Source pages describe that company. They are not an XV-AIsle shipping or return promise.
                </p>
                <ul className="mt-2 space-y-2 text-sm">
                  {offer.citations.map((item) => (
                    <li key={item.href}>
                      <a className="tap-link underline underline-offset-4" href={item.href} rel="noopener noreferrer">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
            {offer.kind === "affiliate" && offer.href ? (
              <a className="tap-link mt-3 inline-block" href={offer.href} rel="noopener noreferrer" target="_blank">
                Open the approved offer
              </a>
            ) : null}
            {offer.kind === "fulfillment" && offer.href ? (
              <Link href={offer.href} className="tap-link mt-3 inline-block">
                View the listing
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SourcedOfferShelf() {
  const [offers, setOffers] = useState<PublicSourcedOffer[] | null>(null);

  useEffect(() => {
    fetch("/api/store/offers")
      .then((response) => response.json())
      .then((data: { offers?: PublicSourcedOffer[] }) => setOffers(data.offers ?? []))
      .catch(() => setOffers([]));
  }, []);

  if (!offers) return null;
  return <SourcedOfferList offers={offers} />;
}
