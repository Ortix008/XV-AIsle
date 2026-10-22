"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { ProductFrame } from "@/components/product-frame";
import { ShareToX } from "@/components/share-to-x";
import { useReveal } from "@/components/reveal";
import { CheckoutPolicies } from "@/components/shop-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStripeCheckoutUrl } from "@/lib/checkout-url";
import { formatCheckDate, HOW_WE_CHECK_HREF } from "@/lib/honest-price";
import { money } from "@/lib/money";
import { QA_CHECKOUT_PRODUCT_ID } from "@/lib/qa-checkout";
import { QA_TEST_BANNER, SAMPLE_UNAVAILABLE } from "@/lib/shelf-copy";
import { productShipLine, SHOPPER_PLACE, shopperDescription } from "@/lib/order-facts";
import { aisleBySlug, aisleByTitle } from "@/lib/aisles";
import { nightWorldBySlug, nightWorldByTitle, nightWorldForListing, nightWorldVars } from "@/lib/night-worlds";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

export type ProductListing = {
  productId: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  image: string;
  supplierName: string;
  supplierOrigin?: string;
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

function productAisleCrumb(listing: ProductListing) {
  const slug = listing.kind === "bundle" ? "bundles" : listing.aisle?.trim() ?? "";
  if (!slug) return null;
  const aisle = aisleBySlug(slug) ?? aisleByTitle(slug);
  if (aisle) return { name: aisle.title, href: `/shop?aisle=${aisle.slug}` };
  const world = nightWorldBySlug(slug) ?? nightWorldByTitle(slug);
  if (world) return { name: world.title, href: `/shop?aisle=${world.slug}` };
  return { name: slug, href: null };
}

export function ProductBuy({
  listing,
  returnNote,
  shareHref,
  testMode = false,
  held = false,
  shipWindow,
}: {
  listing: ProductListing;
  returnNote: string;
  shareHref: string;
  testMode?: boolean;
  held?: boolean;
  shipWindow?: string;
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
  const [details, setDetails] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const check =
    listing.checkedBy && listing.checkedOn && listing.checkedNote
      ? { by: listing.checkedBy, on: listing.checkedOn, note: listing.checkedNote }
      : null;
  const notes = Boolean(listing.whyItCosts || check);
  const world = nightWorldForListing(listing);
  const worldStyle = world ? (nightWorldVars(world) as CSSProperties) : undefined;
  const aisleCrumb = productAisleCrumb(listing);
  const shipping = shipWindow ?? productShipLine(listing);

  useEffect(() => {
    if (details) nameRef.current?.focus();
  }, [details]);

  async function checkout(event: FormEvent) {
    event.preventDefault();
    if (held) return;
    if (!details) {
      setDetails(true);
      return;
    }
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

  const qaCheckout = listing.productId === QA_CHECKOUT_PRODUCT_ID;

  return (
    <div className="product-page">
      {qaCheckout ? (
        <p className="status-chip qa-test-band" role="status">
          {QA_TEST_BANNER}
        </p>
      ) : null}
      <div className="product-photo">
        <div className="product-stage" data-world={world?.slug} style={worldStyle}>
          <ProductFrame src={listing.image} alt={listing.title} sizes="(min-width: 1024px) 560px, 100vw" priority />
        </div>
      </div>
      <div className="product-copy">
        <nav className="product-crumb" aria-label="Breadcrumb">
          <Link href="/shop" className="product-crumb-shop">
            ‹ Shop
          </Link>
          {aisleCrumb ? (
            <>
              <span className="product-crumb-sep" aria-hidden="true">
                /
              </span>
              {aisleCrumb.href ? (
                <Link href={aisleCrumb.href} className="product-crumb-aisle">
                  {aisleCrumb.name}
                </Link>
              ) : (
                <span className="product-crumb-aisle">{aisleCrumb.name}</span>
              )}
            </>
          ) : null}
        </nav>
        <p className="product-sku">{listing.sku}</p>
        {listing.brand ? <p className="product-brand">{listing.brand}</p> : null}
        <h1 className="product-title">{listing.title}</h1>
        <div className="product-price-row">
          <p className="product-price">{money(listing.priceCents / 100)}</p>
          {listing.sample ? <span className="product-sample">Sample</span> : null}
        </div>
        <p className="product-desc">{shopperDescription(listing.description)}</p>
        {testMode && !qaCheckout ? (
          <p className="product-test" role="status">
            Test mode
          </p>
        ) : null}
        <form {...formReveal} onSubmit={checkout} className="product-checkout">
          <div className="product-buy">
            <label className="product-qty-field">
              Quantity
              <Input className="product-qty" type="number" min={1} max={5} value={qty} onChange={(event) => setQty(Number(event.target.value))} />
            </label>
            {held ? (
              <button type="button" className="sample-hold" disabled aria-disabled="true">
                {SAMPLE_UNAVAILABLE}
              </button>
            ) : details ? null : (
              <Button type="submit" className="product-pay">
                Continue to checkout
              </Button>
            )}
          </div>
          {held ? null : <p className="product-pay-line">You pay right here on xvaisle.com.</p>}
          {details && !held ? (
            <div className="product-details">
              <h2 className="product-checkout-label">Checkout</h2>
              <label className="product-field">
                Name
                <Input ref={nameRef} className="h-12" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </label>
              <label className="product-field">
                Email
                <Input className="h-12" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
              </label>
              <label className="product-field">
                Street
                <Input className="h-12" value={line1} onChange={(event) => setLine1(event.target.value)} autoComplete="address-line1" required />
              </label>
              <label className="product-field">
                City
                <Input className="h-12" value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" required />
              </label>
              <label className="product-field">
                State
                <Input className="h-12" value={region} onChange={(event) => setRegion(event.target.value)} autoComplete="address-level1" required />
              </label>
              <label className="product-field">
                Postal code
                <Input className="h-12" value={postal} onChange={(event) => setPostal(event.target.value)} autoComplete="postal-code" required />
              </label>
              {error ? (
                <p className="text-base text-late" role="alert" aria-live="assertive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending} className="product-pay">
                {pending ? "Opening checkout…" : `Pay ${money((listing.priceCents * qty) / 100)}`}
              </Button>
            </div>
          ) : null}
        </form>
        {listing.madeInUsa ? <p className="product-note">Made in the USA.</p> : null}
        {listing.shelf === "small" ? <p className="product-note">This is a small business.</p> : null}
        {listing.kind === "bundle" && listing.includes && listing.includes.length > 0 ? (
          <div className="product-extra">
            <p className="text-sm font-medium text-muted-foreground">In this bundle</p>
            <ul className="mt-2 space-y-1">
              {listing.includes.map((piece) => (
                <li key={piece.productId}>
                  <Link href={`/shop/${piece.productId}`} className="tap-link underline underline-offset-4">
                    {piece.title}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">One price for the whole bundle. The pieces ship to you together.</p>
          </div>
        ) : null}
        {listing.whyWePicked ? (
          <aside className="earned-card" style={worldStyle}>
            <h2 className="text-xl">Why it earned its place</h2>
            <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed">{listing.whyWePicked}</p>
          </aside>
        ) : null}
        {notes ? (
          <dl className="product-notes">
            {listing.whyItCosts ? (
              <div className="product-extra">
                <dt className="text-sm font-medium text-muted-foreground">Why it costs this</dt>
                <dd className="mt-1 whitespace-pre-wrap">{listing.whyItCosts}</dd>
              </div>
            ) : null}
            {check ? (
              <div className="product-extra">
                <dt className="text-sm font-medium text-muted-foreground">Checked by XV</dt>
                <dd className="mt-1 whitespace-pre-wrap">
                  {check.by} on {formatCheckDate(check.on)}. {check.note}
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
        <section className="product-extra">
          <h2 className="text-lg">Shipping & returns</h2>
          <dl className="mt-3 space-y-3 text-base">
            {listing.supplierUsConfirmed === true ? (
              <div>
                <dd className="mt-1">{SHOPPER_PLACE}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Shipping</dt>
              <dd className="mt-1">{shipping}</dd>
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
        <div className="product-links link-row">
          <Link href={HOW_WE_CHECK_HREF} className="tap-link">
            How we check
          </Link>
          <ShareToX href={shareHref} />
        </div>
        <CheckoutPolicies />
      </div>
    </div>
  );
}
