"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { PublicSourcedOffer } from "@/lib/offer-sale";

export function SourcedOfferList({ offers }: { offers: PublicSourcedOffer[] }) {
  if (offers.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-10 sm:px-10" aria-label="Sourcing notes">
      <p className="eyebrow">Sourcing</p>
      <h2 className="mt-3 text-3xl sm:text-4xl">Sourcing notes</h2>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {offers.map((offer) => (
          <li key={offer.id} className="border border-border bg-card p-4">
            <h3 className="text-lg">{offer.title}</h3>
            {offer.note ? <p className="mt-2 text-sm text-muted-foreground">{offer.note}</p> : null}
            {offer.label ? (
              <p className="mt-3 text-sm font-medium" role="status">
                {offer.label}
              </p>
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
