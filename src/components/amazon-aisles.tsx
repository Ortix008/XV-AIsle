import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  AI_SHOPPERS_NOTE,
  AISLE_INDEX_COPY,
  AMAZON_ASSOCIATE_DISCLOSURE,
  AMAZON_PAID_LINK_LABEL,
  AMAZON_PICK_BUTTON_LABEL,
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

function Still({ art, loading }: { art: AisleArt; loading: "eager" | "lazy" }) {
  if (!art.src.trim() || !art.alt.trim()) return null;
  return (
    // Local stills only. next/image is not used, so a later hotlink is not proxied.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art.src}
      alt={art.alt}
      width={800}
      height={800}
      loading={loading}
      decoding="async"
    />
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

export function AisleIndex({ aisles }: { aisles: readonly AmazonAisle[] }) {
  const live = liveAisles(aisles);
  return (
    <article className="affiliate-shell">
      <h1 className="page-title">{AISLE_INDEX_COPY.heading}</h1>
      {AISLE_INDEX_COPY.intro ? <p className="affiliate-intro">{AISLE_INDEX_COPY.intro}</p> : null}
      <AiShoppersNote />
      <ul className="affiliate-index">
        {live.map((aisle) => (
          <li key={aisle.slug}>
            <Link href={`/aisles/${aisle.slug}`} className="affiliate-tile">
              {aisle.art ? (
                <span className="affiliate-tile-art">
                  <Still art={aisle.art} loading="lazy" />
                </span>
              ) : null}
              <span className="affiliate-tile-copy">
                <h2 className="affiliate-card-name">{aisle.name}</h2>
                {aisle.intro ? <p className="affiliate-blurb affiliate-tile-intro">{aisle.intro}</p> : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <JsonLd data={aisleIndexJsonLd(aisles)} />
    </article>
  );
}

export function AisleDetail({ aisle }: { aisle: AmazonAisle }) {
  return (
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
      <p className="affiliate-disclosure">{AMAZON_ASSOCIATE_DISCLOSURE}</p>
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
  );
}
