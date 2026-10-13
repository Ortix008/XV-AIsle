"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useReveal } from "@/components/reveal";
import { CheckoutPolicies } from "@/components/shop-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStripeCheckoutUrl } from "@/lib/checkout-url";
import { formatCheckDate, HOW_WE_CHECK_HREF } from "@/lib/honest-price";
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
  shipsFrom?: string | null;
  deliveryTime?: string | null;
  whyWePicked?: string | null;
  brand?: string | null;
  whyItCosts?: string | null;
  checkedBy?: string | null;
  checkedOn?: string | null;
  checkedNote?: string | null;
};

export function ProductBuy({ listing }: { listing: ProductListing }) {
  const formReveal = useReveal<HTMLFormElement>(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");
  const check =
    listing.checkedBy && listing.checkedOn && listing.checkedNote
      ? { by: listing.checkedBy, on: listing.checkedOn, note: listing.checkedNote }
      : null;
  const notes = Boolean(listing.shipsFrom || listing.deliveryTime || listing.whyWePicked || listing.whyItCosts || check);

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
    <div className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)] lg:items-start lg:gap-x-16">
      <div className="contents lg:order-2 lg:flex lg:flex-col lg:gap-8">
      <div className="order-1">
        <p className="eyebrow">{listing.brand ?? listing.sku}</p>
        {listing.brand ? <p className="mt-2 text-xs tracking-wide text-muted-foreground">{listing.sku}</p> : null}
        <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl">{listing.title}</h1>
        {listing.sample ? <p className="mt-3 text-sm font-medium text-primary">Sample</p> : null}
        <p className="mt-5 max-w-xl text-2xl font-heading tracking-tight">{money(listing.priceCents / 100)}</p>
        <p className="mt-4 max-w-xl whitespace-pre-wrap text-pretty text-base leading-relaxed text-muted-foreground">
          {listing.description}
        </p>
        <p className="mt-4 max-w-xl text-base leading-relaxed">
          {listing.supplierName} in {listing.supplierOrigin} ships it in {listing.shipDaysMin}–{listing.shipDaysMax}{" "}
          days after you pay.
          {listing.madeInUsa ? " Made in the USA." : ""}
          {listing.shelf === "small" ? " This is a small business." : ""}
        </p>
        <p className="mt-2 text-base text-muted-foreground">Shared by an independent reseller. You pay on xvaisle.com.</p>
        {notes ? (
          <dl className="mt-6 grid gap-3 text-base">
            {listing.shipsFrom ? (
              <div className="rounded-2xl border border-border bg-secondary px-5 py-4">
                <dt className="text-sm font-medium text-muted-foreground">Ships from</dt>
                <dd className="mt-1">{listing.shipsFrom}</dd>
              </div>
            ) : null}
            {listing.deliveryTime ? (
              <div className="rounded-2xl border border-border bg-secondary px-5 py-4">
                <dt className="text-sm font-medium text-muted-foreground">Delivery time</dt>
                <dd className="mt-1">{listing.deliveryTime}</dd>
              </div>
            ) : null}
            {listing.whyWePicked ? (
              <div className="rounded-2xl border border-border bg-secondary px-5 py-4">
                <dt className="text-sm font-medium text-muted-foreground">Why we picked it</dt>
                <dd className="mt-1 whitespace-pre-wrap">{listing.whyWePicked}</dd>
              </div>
            ) : null}
            {listing.whyItCosts ? (
              <div className="rounded-2xl border border-border bg-secondary px-5 py-4">
                <dt className="text-sm font-medium text-muted-foreground">Why it costs this</dt>
                <dd className="mt-1 whitespace-pre-wrap">{listing.whyItCosts}</dd>
              </div>
            ) : null}
            {check ? (
              <div className="rounded-2xl border border-border bg-secondary px-5 py-4">
                <dt className="text-sm font-medium text-muted-foreground">Checked by XV</dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {check.by} on {formatCheckDate(check.on)}. {check.note}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <p className="mt-4 text-sm">
          <Link href={HOW_WE_CHECK_HREF} className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
            How we check
          </Link>
        </p>
      </div>
      <form {...formReveal} onSubmit={checkout} className="order-3 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <h2 className="text-xl">Checkout</h2>
        <label className="flex flex-col gap-1 text-base">
          Quantity
          <Input className="h-11" type="number" min={1} max={5} value={qty} onChange={(event) => setQty(Number(event.target.value))} />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Name
          <Input className="h-11" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Email
          <Input className="h-11" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Street
          <Input className="h-11" value={line1} onChange={(event) => setLine1(event.target.value)} autoComplete="address-line1" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          City
          <Input className="h-11" value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          State
          <Input className="h-11" value={region} onChange={(event) => setRegion(event.target.value)} autoComplete="address-level1" required />
        </label>
        <label className="flex flex-col gap-1 text-base">
          Postal code
          <Input className="h-11" value={postal} onChange={(event) => setPostal(event.target.value)} autoComplete="postal-code" required />
        </label>
        {error ? <p className="text-base text-late">{error}</p> : null}
        <Button type="submit" disabled={pending} className="mt-2 h-12 w-full rounded-full text-[15px]">
          {pending ? "Opening checkout…" : `Pay ${money((listing.priceCents * qty) / 100)}`}
        </Button>
        <p className="text-base text-pretty text-muted-foreground">
          You pay on xvaisle.com. Stripe handles the card. We never see your card number.
        </p>
        <CheckoutPolicies />
      </form>
      </div>
      <div className="media-well relative order-2 aspect-[4/5] w-full overflow-hidden rounded-[14px] border border-border lg:order-1">
        {listing.image ? (
          <Image
            src={listing.image}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover object-center"
          />
        ) : null}
      </div>
    </div>
  );
}
