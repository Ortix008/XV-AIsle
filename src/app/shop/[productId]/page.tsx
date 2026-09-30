"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ShopFrame } from "@/components/shop-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "@/lib/money";

type Listing = {
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
};

export default function ProductPage() {
  const params = useParams<{ productId: string }>();
  const [listing, setListing] = useState<Listing | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");

  useEffect(() => {
    fetch(`/api/store/listings/${params.productId}`)
      .then(async (response) => {
        if (!response.ok) {
          setMissing(true);
          return;
        }
        const data = (await response.json()) as { listing: Listing };
        setListing(data.listing);
      })
      .catch(() => setMissing(true));
  }, [params.productId]);

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (!listing) return;
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
    if (!response.ok || !data?.url) {
      setError(data?.error ?? "Checkout did not open.");
      setPending(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <ShopFrame>
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
        {missing ? <p className="text-sm text-muted-foreground">That page is not on the store.</p> : null}
        {listing ? (
          <>
            <div>
              <div className="relative aspect-[4/3] bg-card">
                {listing.image ? <Image src={listing.image} alt="" fill sizes="640px" className="object-cover" /> : null}
              </div>
              <p className="mt-4 text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                {listing.sku}
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">{listing.title}</h1>
              <p className="mt-3 max-w-xl whitespace-pre-wrap text-pretty text-sm leading-relaxed text-muted-foreground">
                {listing.description}
              </p>
              <p className="mt-3 text-sm">
                {money(listing.priceCents / 100)}. {listing.supplierName} in {listing.supplierOrigin} ships it in{" "}
                {listing.shipDaysMin}–{listing.shipDaysMax} days after payment.
                {listing.madeInUsa ? " Made in the USA." : ""}
                {listing.shelf === "small" ? " This is a small business." : ""}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                A post on X opens this page. Payment stays here.{" "}
                <Link href="/shop/x" className="underline underline-offset-4">
                  How a sale from X works
                </Link>
                .
              </p>
            </div>
            <form onSubmit={checkout} className="flex flex-col gap-3 border bg-card p-4">
              <h2 className="text-sm font-medium">Ship to</h2>
              <label className="flex flex-col gap-1 text-sm">
                Quantity
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={qty}
                  onChange={(event) => setQty(Number(event.target.value))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Name
                <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Email
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Street
                <Input value={line1} onChange={(event) => setLine1(event.target.value)} autoComplete="address-line1" required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                City
                <Input value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                State
                <Input value={region} onChange={(event) => setRegion(event.target.value)} autoComplete="address-level1" required />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Postal code
                <Input value={postal} onChange={(event) => setPostal(event.target.value)} autoComplete="postal-code" required />
              </label>
              {error ? <p className="text-sm text-late">{error}</p> : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Opening checkout…" : `Pay ${money((listing.priceCents * qty) / 100)}`}
              </Button>
              <p className="text-xs text-pretty text-muted-foreground">
                Ships in the US. The card is entered on Stripe. This store does not keep the number.{" "}
                <Link href="/shop/safety" className="underline underline-offset-4">
                  How an order is handled
                </Link>
                .
              </p>
            </form>
          </>
        ) : null}
      </div>
    </ShopFrame>
  );
}
