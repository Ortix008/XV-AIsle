import { AffiliateLink } from "@/components/affiliate-link";
import {
  AFFILIATE_OFFERS,
  AFFILIATE_SPOT_HEADING,
  visibleAffiliateOffers,
  visibleAffiliatePicks,
  type AffiliateItem,
  type AffiliateOffer,
  type AffiliateSpot,
} from "@/config/affiliates";
import { servedTrackingHref, type Traffic } from "@/lib/agent-traffic";

export function AffiliateSpot({
  spot,
  item,
  offers = AFFILIATE_OFFERS,
  traffic = null,
}: {
  spot: AffiliateSpot;
  item?: AffiliateItem | null;
  offers?: readonly AffiliateOffer[];
  traffic?: Traffic | null;
}) {
  const shown = visibleAffiliateOffers(spot, item, offers);
  if (shown.length === 0) return null;
  return (
    <section className={`partner-spot partner-spot-${spot}`}>
      <h2 className="partner-spot-heading">{AFFILIATE_SPOT_HEADING[spot]}</h2>
      <ul className="partner-spot-list">
        {shown.flatMap((offer) => {
          const cards = [
            {
              key: offer.id,
              href: offer.href,
              id: offer.id,
              heading: undefined as string | undefined,
              blurb: undefined as string | undefined,
              label: offer.label,
            },
            ...visibleAffiliatePicks(offer.picks).map((pick) => ({
              key: `${offer.id}-${pick.id}`,
              href: pick.href,
              id: pick.id,
              heading: pick.name,
              blurb: pick.why,
              label: pick.label,
            })),
          ];
          return cards.map((card) => (
            <li key={card.key}>
              <AffiliateLink
                href={card.href ? servedTrackingHref(card.href, card.id, traffic) : card.href}
                label={card.label}
                network={offer.network}
                item={item}
                disclosure={offer.disclosure}
                heading={card.heading}
                blurb={card.blurb}
              />
            </li>
          ));
        })}
      </ul>
    </section>
  );
}

/** Bookshop stays on Home & Gifts. Zazzle gift cards live on the Holiday aisle. */
export function HomeGiftSpots({
  offers = AFFILIATE_OFFERS,
  traffic = null,
}: {
  offers?: readonly AffiliateOffer[];
  traffic?: Traffic | null;
}) {
  const spots = (["books"] as const).filter((spot) => visibleAffiliateOffers(spot, null, offers).length > 0);
  if (spots.length === 0) return null;
  return (
    <div className={spots.length === 1 ? "partner-spot-row partner-spot-solo" : "partner-spot-row"}>
      {spots.map((spot) => (
        <AffiliateSpot key={spot} spot={spot} offers={offers} traffic={traffic} />
      ))}
    </div>
  );
}
