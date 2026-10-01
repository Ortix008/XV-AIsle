"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStripeCheckoutUrl } from "@/lib/checkout-url";
import { money } from "@/lib/money";

export type ProductListing = {
  productId: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  image: string;
  supplierName: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  madeInUsa?: boolean;
  shelf?: string;
  sample?: boolean;
};

export function ProductBuy({ listing }: { listing: ProductListing }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");

  async function checkout(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/store/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: listing.productId,
        qty,
        name,
        email,
        line1,
        city,
        region,
        postal,
        country: "US",
      }),
    });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url || !isStripeCheckoutUrl(data.url)) {
      setError(data?.error ?? "Checkout did not open. Check the form and try again.");
      setPending(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
      <div>
        <div className="relative aspect-[4/3] bg-card">
          {listing.image ? (
            <Image src={listing.image} alt={listing.title} fill sizes="640px" className="object-cover" />
          ) : null}
        </div>
        <p className="mt-4 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">{listing.sku}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{listing.title}</h1>
        {listing.sample ? <p className="mt-2 text-sm font-medium">Sample</p> : null}
        <p className="mt-3 max-w-xl whitespace-pre-wrap text-pretty text-base leading-relaxed">{listing.description}</p>
        <p className="mt-3 text-base">
          {money(listing.priceCents / 100)}. {listing.supplierName} in {listing.supplierOrigin} ships it in{" "}
          {listing.shipDaysMin}–{listing.shipDaysMax} days after you pay.
          {listing.madeInUsa ? " Made in the USA." : ""}
          {listing.shelf === "small" ? " This is a small business." : ""}
        </p>
        <p className="mt-2 text-base">Shared by an independent reseller. You pay on xvaisle.com.</p>
      </div>
      <form onSubmit={checkout} className="flex flex-col gap-3 border bg-card p-4">
        <h2 className="text-base font-medium">Ship to</h2>
        <label className="flex flex-col gap-1 text-base">
          Quantity
          <Input type="number" min={1} max={5} value={qty} onChange={(event) => setQty(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Name
          <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Email
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Street
          <Input value={line1} onChange={(event) => setLine1(event.target.value)} autoComplete="address-line1" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          City
          <Input value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          State
          <Input value={region} onChange={(event) => setRegion(event.target.value)} autoComplete="address-level1" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Postal code
          <Input value={postal} onChange={(event) => setPostal(event.target.value)} autoComplete="postal-code" required />
        </label>
        {error ? <p className="text-base text-late">{error}</p> : null}
        <Button type="submit" disabled={pending} className="h-11">
          {pending ? "Opening checkout…" : `Pay ${money((listing.priceCents * qty) / 100)}`}
        </Button>
        <p className="text-base text-pretty">
          You pay on xvaisle.com. Stripe handles the card. We never see your card number.{" "}
          <Link href="/shop/safety" className="underline underline-offset-4">
            How buying works
          </Link>
          .
        </p>
      </form>
    </div>
  );
}
