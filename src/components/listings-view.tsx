"use client";

import Link from "next/link";
import { BotControls } from "@/components/desk-shell";
import { CopyButton, EmptyNote, MockupFrame, Money, PageHeader, Tone } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getProduct } from "@/lib/catalog";
import { useDesk } from "@/lib/desk-store";
import { publishListing } from "@/lib/store-client";
import { listingText } from "@/lib/engine";
import { costStack, landedCost, money, pct } from "@/lib/money";
import type { Listing, PriceId } from "@/lib/types";
import { cn } from "cn";
import { useEffect, useState } from "react";

export function ListingsView() {
  const { state, select, updateListing, setListingStatus, rebuildListing } = useDesk();
  const approved = state.pipeline.filter((item) => item.status === "approved");
  const selectedId =
    approved.find((item) => item.productId === state.selected.listing)?.productId ??
    approved[0]?.productId;
  const listing = state.listings.find((item) => item.productId === selectedId);
  const pipelineItem = approved.find((item) => item.productId === selectedId);

  return (
    <div className="flex flex-col lg:h-full">
      <PageHeader
        kicker="Draft"
        title="Write the page"
        lede="The page is written only after you say yes to a product. Mark it ready when you would actually sell it."
        actions={<BotControls id="listings" />}
      />
      {approved.length === 0 ? (
        <EmptyNote
          title="No approved products."
          body="Say yes to a product in Signal first. Draft will not invent one."
        />
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:overflow-hidden">
          <ul className="border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
            {approved.map((item) => {
              const product = getProduct(item.productId);
              const draft = state.listings.find((listing) => listing.productId === item.productId);
              const active = item.productId === selectedId;
              return (
                <li key={item.productId} className="border-b">
                  <button
                    type="button"
                    onClick={() => select("listing", item.productId)}
                    className={cn(
                      "flex w-full flex-col items-start px-4 py-3 text-left",
                      active ? "bg-muted/70" : "hover:bg-muted/40",
                    )}
                  >
                    <span className="text-sm font-medium">{product.titleLead}</span>
                    <span className="text-xs text-muted-foreground">
                      {draft ? (draft.status === "ready" ? "Ready to sell" : "Needs you") : "Not written yet"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="min-w-0 lg:overflow-y-auto">
            {selectedId && pipelineItem ? (
              listing ? (
                <ListingEditor
                  listing={listing}
                  onChange={(patch) => updateListing(listing.productId, patch)}
                  onStatus={(status) => setListingStatus(listing.productId, status)}
                  onRebuild={() => rebuildListing(listing.productId)}
                  supplierId={pipelineItem.pickedSupplierId}
                />
              ) : (
                <EmptyNote
                  title="No draft yet."
                  body="Run one Draft pass, or write this product now. The words use the supplier you picked in Signal."
                  action={
                    <Button type="button" onClick={() => rebuildListing(selectedId)}>
                      Draft this listing
                    </Button>
                  }
                />
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function ListingEditor({
  listing,
  supplierId,
  onChange,
  onStatus,
  onRebuild,
}: {
  listing: Listing;
  supplierId: string | null;
  onChange: (patch: Partial<Listing>) => void;
  onStatus: (status: Listing["status"]) => void;
  onRebuild: () => void;
}) {
  const product = getProduct(listing.productId);
  const [tag, setTag] = useState("");
  const [storeError, setStoreError] = useState<string | null>(null);
  const [storePending, setStorePending] = useState(false);
  const [shipFloors, setShipFloors] = useState<{ id: string; name: string }[]>([]);
  const [floorId, setFloorId] = useState("");
  const [smallShops, setSmallShops] = useState<{ id: string; name: string; city: string; madeInUsa: boolean }[]>([]);
  const [smallId, setSmallId] = useState("");
  const [madeInUsa, setMadeInUsa] = useState(false);
  const [catalog, setCatalog] = useState<
    { id: string; title: string; sku: string; costCents: number; shippingCents: number; supplierName: string }[]
  >([]);
  const [catalogItemId, setCatalogItemId] = useState("");
  const [feeBps, setFeeBps] = useState("");
  useEffect(() => {
    fetch("/api/floors")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { floors?: { id: string; name: string; status: string }[] };
        setShipFloors((data.floors ?? []).filter((floor) => floor.status === "shipping"));
      })
      .catch(() => setShipFloors([]));
    fetch("/api/supplier/catalog")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { items?: typeof catalog };
        setCatalog(data.items ?? []);
      })
      .catch(() => setCatalog([]));
    fetch("/api/shops/small")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { shops?: { id: string; name: string; city: string; madeInUsa: boolean }[] };
        setSmallShops(data.shops ?? []);
      })
      .catch(() => setSmallShops([]));
  }, []);
  const agreedFloor = shipFloors.find((floor) => floor.id === floorId) ?? null;
  const smallShop = smallShops.find((shop) => shop.id === smallId) ?? null;
  const price = listing.prices.find((item) => item.id === listing.priceId) ?? listing.prices[0];
  const supplier =
    product.suppliers.find((item) => item.id === listing.supplierId) ?? product.suppliers[0];
  const shipperName = smallShop?.name ?? agreedFloor?.name ?? supplier.name;
  const shipperOrigin = smallShop ? smallShop.city : agreedFloor ? "US warehouses" : supplier.origin;
  const shelf = smallShop ? "small" : "national";
  const landed = landedCost(supplier);
  const stack = costStack(price.retail, landed);
  const stale = (supplierId ?? supplier.id) !== listing.supplierId && supplierId != null;
  const moneyFields = {
    catalogItemId,
    ...(feeBps.trim() ? { feeBps: Number(feeBps) } : {}),
  };
  const activeSupplier = supplierId
    ? product.suppliers.find((item) => item.id === supplierId)
    : null;

  return (
    <div className="flex flex-col gap-6 px-4 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{product.titleLead}</h2>
          <p className="text-sm text-muted-foreground">
            {listing.status === "ready" ? (
              <Tone tone="ok">Ready</Tone>
            ) : (
              <Tone tone="warn">Draft</Tone>
            )}
            <span> · {product.sku}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={listingText(listing, product)} label="Copy listing" />
          {listing.status === "draft" ? (
            <Button
              type="button"
              disabled={storePending}
              onClick={() => {
                setStorePending(true);
                setStoreError(null);
                const supplierQuote = supplier;
                void publishListing({
                  productId: listing.productId,
                  sku: product.sku,
                  title: listing.titles[listing.titleIndex] ?? product.titleLead,
                  description: [listing.description, ...listing.bullets].filter(Boolean).join("\n"),
                  priceCents: Math.round(price.retail * 100),
                  image: product.mockups[0]?.src ?? "",
                  supplierName: shipperName,
                  supplierOrigin: shipperOrigin,
                  shipDaysMin: supplierQuote.shipDaysMin,
                  shipDaysMax: supplierQuote.shipDaysMax,
                  published: true,
                  madeInUsa: madeInUsa || smallShop?.madeInUsa === true,
                  shelf,
                  ...moneyFields,
                }).then((message) => {
                  setStorePending(false);
                  if (message) {
                    setStoreError(message);
                    return;
                  }
                  onStatus("ready");
                });
              }}
            >
              {storePending ? "Putting it on the store…" : "Mark ready"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={storePending}
              onClick={() => {
                setStorePending(true);
                void publishListing({
                  productId: listing.productId,
                  sku: product.sku,
                  title: listing.titles[listing.titleIndex] ?? product.titleLead,
                  description: listing.description,
                  priceCents: Math.round(price.retail * 100),
                  image: product.mockups[0]?.src ?? "",
                  supplierName: shipperName,
                  supplierOrigin: shipperOrigin,
                  shipDaysMin: supplier.shipDaysMin,
                  shipDaysMax: supplier.shipDaysMax,
                  published: false,
                  madeInUsa: madeInUsa || smallShop?.madeInUsa === true,
                  shelf,
                  ...moneyFields,
                }).then((message) => {
                  setStorePending(false);
                  if (message) {
                    setStoreError(message);
                    return;
                  }
                  onStatus("draft");
                });
              }}
            >
              Return to draft
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Supplier catalog item
          <select
            value={catalogItemId}
            onChange={(event) => setCatalogItemId(event.target.value)}
            className="h-9 border bg-background px-2"
          >
            <option value="">Choose an approved item</option>
            {catalog.map((item) => (
              <option key={item.id} value={item.id}>
                {item.supplierName} · {item.title} · {item.costCents}¢ + {item.shippingCents}¢ ship
              </option>
            ))}
          </select>
        </label>
        <Input
          value={feeBps}
          onChange={(event) => setFeeBps(event.target.value)}
          inputMode="numeric"
          placeholder="Platform fee basis points, 800–1200"
        />
      </div>
      <p className="text-xs text-pretty text-muted-foreground">
        Cost and shipping come from the supplier’s catalog. A reseller cannot set them, and cannot list their own
        supply. Leave the fee blank for the platform default. Publishing needs an active membership and a finished
        Stripe payout setup.
      </p>
      {storeError ? <p className="text-sm text-late">{storeError}</p> : null}
      {listing.status === "ready" ? (
        <p className="text-sm">
          <Link href={`/shop/${listing.productId}`} className="underline underline-offset-4">
            Open this page on the store
          </Link>
        </p>
      ) : null}

      {stale && activeSupplier ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border border-border bg-muted/40 px-3 py-2 text-sm">
          <p>
            Signal is now using {activeSupplier.name}. This draft still prices {supplier.name}.
          </p>
          <Button type="button" size="sm" variant="outline" onClick={onRebuild}>
            Rebuild from the new quote
          </Button>
        </div>
      ) : null}

      <fieldset>
        <legend className="text-sm font-medium">Title</legend>
        <div className="mt-2 space-y-2">
          {listing.titles.map((title, index) => (
            <label key={index} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name={`title-${listing.productId}`}
                className="mt-1"
                checked={listing.titleIndex === index}
                onChange={() => onChange({ titleIndex: index })}
              />
              <span>
                {title}{" "}
                <span className="text-xs text-muted-foreground">{title.length} characters</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <h3 className="text-sm font-medium">Pictures for the page</h3>
        <p className="mt-1 text-pretty text-xs text-muted-foreground">
          Pictures the customer can see. Copy the words when you are ready to use one.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {product.mockups.map((idea) => (
            <MockupFrame key={idea.title} idea={idea} swatch={product.swatch} />
          ))}
        </div>
      </div>

      <label className="block">
        <span className="text-sm font-medium">Description</span>
        <Textarea
          value={listing.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={12}
          maxLength={8000}
          className="mt-2 text-sm leading-relaxed"
        />
      </label>

      <div>
        <p className="text-sm font-medium">Bullets</p>
        <div className="mt-2 space-y-2">
          {listing.bullets.map((bullet, index) => (
            <Input
              key={index}
              value={bullet}
              maxLength={400}
              aria-label={`Bullet ${index + 1}`}
              onChange={(event) => {
                const bullets = listing.bullets.map((item, itemIndex) =>
                  itemIndex === index ? event.target.value : item,
                );
                onChange({ bullets });
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium">Tags</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {listing.tags.map((item) => (
            <li key={item}>
              <button
                type="button"
                className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => onChange({ tags: listing.tags.filter((tag) => tag !== item) })}
              >
                {item} <span className="text-muted-foreground">remove</span>
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex max-w-sm gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = tag.trim().toLowerCase().slice(0, 40);
            if (!next || listing.tags.includes(next)) {
              setTag("");
              return;
            }
            onChange({ tags: [...listing.tags, next].slice(0, 13) });
            setTag("");
          }}
        >
          <Input
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            placeholder="Add a tag"
            maxLength={40}
            aria-label="Add a tag"
          />
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>
      </div>

      <div>
        <p className="text-sm font-medium">Price</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <caption className="sr-only">Price options</caption>
            <thead className="text-xs text-muted-foreground">
              <tr className="border-y">
                <th className="py-2 font-medium">Use</th>
                <th className="px-2 py-2 font-medium">Price</th>
                <th className="px-2 py-2 font-medium">Net</th>
                <th className="py-2 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {listing.prices.map((option) => (
                <tr key={option.id} className="border-b">
                  <td className="py-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`price-${listing.productId}`}
                        checked={listing.priceId === option.id}
                        onChange={() => onChange({ priceId: option.id as PriceId })}
                      />
                      {option.label}
                    </label>
                  </td>
                  <td className="px-2 py-2">
                    <Money value={option.retail} />
                  </td>
                  <td className="px-2 py-2 font-mono tabular-nums">{pct(option.margin)}</td>
                  <td className="py-2 text-muted-foreground">{option.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <dl className="mt-3 max-w-sm divide-y border-y text-sm">
          <Row label="Landed" value={money(landed)} />
          <Row label="Card fees" value={money(stack.fees)} />
          <Row label="Ad allowance" value={money(stack.ads)} />
          <Row label="Left over" value={money(stack.profit)} />
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Quoted from {supplier.name}, {supplier.origin}. Rebuild if you change the quote in Signal.
        </p>
        {shipFloors.length > 0 ? (
          <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">
            Ship from a floor that agreed
            <select
              value={floorId}
              onChange={(event) => setFloorId(event.target.value)}
              className="h-9 border bg-background px-2"
            >
              <option value="">Keep {supplier.name}</option>
              {shipFloors.map((floor) => (
                <option key={floor.id} value={floor.id}>
                  {floor.name}
                </option>
              ))}
            </select>
            <span className="text-xs text-pretty text-muted-foreground">
              Their name goes on the store as the company that ships. The price still uses the quote above.
            </span>
          </label>
        ) : (
          <p className="mt-3 text-xs text-pretty text-muted-foreground">
            When a national floor agrees to ship, mark them on Floors and their name can go on this page.
          </p>
        )}
        {smallShops.length > 0 ? (
          <label className="mt-4 flex max-w-sm flex-col gap-1 text-sm">
            Or a small business
            <select value={smallId} onChange={(event) => setSmallId(event.target.value)} className="h-9 border bg-background px-2">
              <option value="">Keep the floor above</option>
              {smallShops.map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}, {shop.city}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="mt-3 text-xs text-pretty text-muted-foreground">
            Add a small business on Floors when a neighborhood shop should have its own page.
          </p>
        )}
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={madeInUsa} onChange={(event) => setMadeInUsa(event.target.checked)} />
          Made in the USA. Use this only when the goods are made here.
        </label>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono tabular-nums">{value}</dd>
    </div>
  );
}
