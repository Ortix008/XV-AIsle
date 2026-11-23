import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { runWithTraffic, type Traffic } from "@/lib/agent-traffic";
import {
  AI_SHOPPERS_NOTE,
  AISLE_INDEX_COPY,
  AMAZON_ASSOCIATE_DISCLOSURE,
  AMAZON_PAID_LINK_LABEL,
  AMAZON_PICK_BUTTON_LABEL,
  AISLE_TILE_SIZES,
  aisleCardArt,
  aisleIndexJsonLd,
  aisleProductJsonLd,
  amazonPickUrl,
  liveAisles,
  pickLinkLabel,
  resolvePickImage,
  type AisleArt,
  type AmazonAisle,
} from "@/lib/amazon-aisles";

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const TILE_SIZES = AISLE_TILE_SIZES;

function Still({
  art,
  loading,
  fetchPriority,
}: {
  art: AisleArt;
  loading: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
}) {
  if (!art.src.trim() || !art.alt.trim()) return null;
  const priority = fetchPriority === "high" && Boolean(art.srcSet);
  return (
    <picture>
      {priority && art.avifSrcSet ? <source type="image/avif" srcSet={art.avifSrcSet} sizes={TILE_SIZES} /> : null}
      <img
        src={art.src}
        alt={art.alt}
        width={800}
        height={800}
        loading={loading}
        decoding="async"
        {...(priority
          ? { fetchPriority: "high" as const, sizes: TILE_SIZES, srcSet: art.srcSet }
          : {})}
      />
    </picture>
  );
}

function PickArt({ item, aisle }: { item: AmazonAisle["items"][number]; aisle: AmazonAisle }) {
  const image = resolvePickImage(item, aisle);
  if (!image) return null;
  return (
    <div className="affiliate-art">
      {/* Hotlink only. next/image would proxy and cache a remote file on this server. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} loading="lazy" decoding="async" />
    </div>
  );
}

function AiShoppersNote() {
  if (!AI_SHOPPERS_NOTE) return null;
  return <p className="affiliate-note">{AI_SHOPPERS_NOTE}</p>;
}

export function AisleIndex({
  aisles,
  includeTickets = false,
  extras = [],
}: {
  aisles: readonly AmazonAisle[];
  includeTickets?: boolean;
  extras?: readonly { href: string; name: string; intro: string; art?: AisleArt }[];
}) {
  const live = [
    ...liveAisles(aisles),
    ...(includeTickets ? aisles.filter((aisle) => aisle.slug === "tickets-and-events" && aisle.items.length === 0) : []),
  ];
  return (
    <article className="affiliate-shell">
      <h1 className="page-title">{AISLE_INDEX_COPY.heading}</h1>
      {AISLE_INDEX_COPY.intro ? <p className="affiliate-intro">{AISLE_INDEX_COPY.intro}</p> : null}
      <AiShoppersNote />
      <ul className="affiliate-index">
        {extras.map((extra, index) => (
          <li key={extra.href}>
            <Link href={extra.href} className="affiliate-tile">
              {extra.art ? (
                <span className="affiliate-tile-art">
                  <Still
                    art={extra.art}
                    loading={index === 0 ? "eager" : "lazy"}
                    fetchPriority={index === 0 ? "high" : undefined}
                  />
                </span>
              ) : null}
              <span className="affiliate-tile-copy">
                <h2 className="affiliate-card-name">{extra.name}</h2>
                {extra.intro ? <p className="affiliate-blurb affiliate-tile-intro">{extra.intro}</p> : null}
              </span>
            </Link>
          </li>
        ))}
        {live.map((aisle, index) => {
          const art = aisle.art ?? aisleCardArt(aisle.slug);
          const position = extras.length + index;
          const eager = position === 0;
          return (
            <li key={aisle.slug}>
              <Link href={`/aisles/${aisle.slug}`} className="affiliate-tile">
                {art ? (
                  <span className="affiliate-tile-art">
                    <Still art={art} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : undefined} />
                  </span>
                ) : null}
                <span className="affiliate-tile-copy">
                  <h2 className="affiliate-card-name">{aisle.name}</h2>
                  {aisle.intro ? <p className="affiliate-blurb affiliate-tile-intro">{aisle.intro}</p> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <JsonLd data={aisleIndexJsonLd(aisles)} />
    </article>
  );
}

export function AisleDetail({
  aisle,
  belowHero = null,
  traffic = null,
}: {
  aisle: AmazonAisle;
  belowHero?: ReactNode;
  traffic?: Traffic | null;
}) {
  return runWithTraffic(traffic, () => (
    <article className="affiliate-shell">
      <header className="affiliate-hero">
        <div className="affiliate-hero-copy">
          <h1 className="page-title">{aisle.heading}</h1>
          {aisle.intro ? <p className="affiliate-intro">{aisle.intro}</p> : null}
          <AiShoppersNote />
        </div>
        {aisle.art ? (
          <div className="affiliate-hero-frame">
            <Still art={aisle.art} loading="eager" />
          </div>
        ) : null}
      </header>
      {belowHero}
      {aisle.items.length > 0 ? <p className="affiliate-disclosure">{AMAZON_ASSOCIATE_DISCLOSURE}</p> : null}
      <ul className="affiliate-grid">
        {aisle.items.map((item) => (
          <li key={item.asin}>
            <article className="affiliate-card">
              <PickArt item={item} aisle={aisle} />
              <h2 className="affiliate-card-name">{item.name}</h2>
              {item.blurb ? <p className="affiliate-blurb">{item.blurb}</p> : null}
              {item.note ? <p className="affiliate-fine">{item.note}</p> : null}
              <div className="affiliate-buy-row">
                <Button asChild className="affiliate-buy">
                  <a
                    href={amazonPickUrl(item.asin)}
                    target="_blank"
                    rel="sponsored nofollow noopener"
                    aria-label={pickLinkLabel(item.name)}
                  >
                    {AMAZON_PICK_BUTTON_LABEL}
                  </a>
                </Button>
                <span className="affiliate-paid">{AMAZON_PAID_LINK_LABEL}</span>
              </div>
            </article>
          </li>
        ))}
      </ul>
      <JsonLd data={aisleProductJsonLd(aisle)} />
    </article>
  ));
}
