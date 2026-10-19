"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import { ProductFrame } from "@/components/product-frame";
import { ShareToX } from "@/components/share-to-x";
import { useReveal } from "@/components/reveal";
import { CheckoutPolicies } from "@/components/shop-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStripeCheckoutUrl } from "@/lib/checkout-url";
import { formatCheckDate, HOW_WE_CHECK_HREF } from "@/lib/honest-price";
import { money } from "@/lib/money";
import { productShipLine } from "@/lib/order-facts";
import { nightWorldForListing, nightWorldVars } from "@/lib/night-worlds";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

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
  supplierUsConfirmed?: boolean;
  deliveryTime?: string | null;
  whyWePicked?: string | null;
  brand?: string | null;
  whyItCosts?: string | null;
  checkedBy?: string | null;
  checkedOn?: string | null;
  checkedNote?: string | null;
  kind?: "bundle";
  includes?: { productId: string; title: string }[];
  aisle?: string | null;
};

export function ProductBuy({
  listing,
  returnNote,
  shareHref,
  testMode = false,
}: {
  listing: ProductListing;
  returnNote: string;
  shareHref: string;
  testMode?: boolean;
}) {
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
  const notes = Boolean(listing.whyItCosts || check);
  const world = nightWorldForListing(listing);
  const worldStyle = world ? (nightWorldVars(world) as CSSProperties) : undefined;

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
      setError(data?.error ?? "Checkout didn't open. Take a quick look at the form and try again.");
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
        <ShareToX href={shareHref} className="mt-5" />
        {listing.sample ? <p className="mt-3 text-sm font-medium text-primary">Sample</p> : null}
        <p className="mt-5 max-w-xl text-2xl font-heading tracking-tight">{money(listing.priceCents / 100)}</p>
        <p className="mt-4 max-w-xl whitespace-pre-wrap text-pretty text-base leading-relaxed text-muted-foreground">
          {listing.description}
        </p>
        <p className="mt-4 max-w-xl text-base leading-relaxed">{productShipLine(listing)}</p>
        {listing.shipsFrom?.trim() || !listing.supplierOrigin.trim() ? null : (
          <p className="mt-2 max-w-xl text-base leading-relaxed">Ships from {listing.supplierOrigin}.</p>
        )}
        {listing.madeInUsa ? <p className="mt-2 max-w-xl text-base leading-relaxed">Made in the USA.</p> : null}
        {listing.shelf === "small" ? <p className="mt-2 max-w-xl text-base leading-relaxed">This is a small business.</p> : null}
        <p className="mt-2 text-base text-muted-foreground">You pay right here on xvaisle.com.</p>
        {listing.kind === "bundle" && listing.includes && listing.includes.length > 0 ? (
          <div className="mt-6 max-w-xl rounded-2xl border border-border bg-secondary px-5 py-4">
            <p className="text-sm font-medium text-muted-foreground">In this bundle</p>
            <ul className="mt-2 space-y-1">
              {listing.includes.map((piece) => (
                <li key={piece.productId}>
                  <Link href={`/shop/${piece.productId}`} className="underline underline-offset-4">
                    {piece.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">One price for the whole bundle. The pieces ship to you together.</p>
          </div>
        ) : null}
        {listing.whyWePicked ? (
          <aside className="earned-card mt-6 max-w-xl" style={worldStyle}>
            <h2 className="text-xl">Why it earned its place</h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{listing.whyWePicked}</p>
          </aside>
        ) : null}
        {notes ? (
          <dl className="mt-6 grid gap-3 text-base">
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
        {testMode ? (
          <p className="rounded-xl border border-primary bg-primary/15 px-3 py-2 text-center text-sm font-semibold tracking-wide text-primary" role="status">
            Test mode
          </p>
        ) : null}
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
      <div className="order-2 flex flex-col gap-4 lg:order-1">
        <div className="product-stage" data-world={world?.slug} style={worldStyle}>
          <ProductFrame src={listing.image} alt={listing.title} sizes="(min-width: 1024px) 50vw, 100vw" priority />
        </div>
        <section className="rounded-2xl border border-border bg-card px-5 py-4">
          <h2 className="text-lg">Shipping & returns</h2>
          <dl className="mt-3 space-y-3 text-base">
            {listing.shipsFrom ? (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Ships from</dt>
                <dd className="mt-1">{listing.shipsFrom}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Shipping</dt>
              <dd className="mt-1">{productShipLine(listing)}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Returns</dt>
              <dd className="mt-1">You can start a return within {RETURN_WINDOW_DAYS} days of delivery.</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Return address</dt>
              <dd className="mt-1">{returnNote}</dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
