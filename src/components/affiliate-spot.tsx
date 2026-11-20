import { AffiliateLink } from "@/components/affiliate-link";
import {
  AFFILIATE_OFFERS,
  AFFILIATE_SPOT_HEADING,
  visibleAffiliateOffers,
  type AffiliateItem,
  type AffiliateOffer,
  type AffiliateSpot,
} from "@/config/affiliates";

export function AffiliateSpot({
  spot,
  item,
  offers = AFFILIATE_OFFERS,
}: {
  spot: AffiliateSpot;
  item?: AffiliateItem | null;
  offers?: readonly AffiliateOffer[];
}) {
  const shown = visibleAffiliateOffers(spot, item, offers);
  if (shown.length === 0) return null;
  return (
    <section className={`partner-spot partner-spot-${spot}`}>
      <h2 className="partner-spot-heading">{AFFILIATE_SPOT_HEADING[spot]}</h2>
      <ul className="partner-spot-list">
        {shown.map((offer) => (
          <li key={offer.id}>
            <AffiliateLink
              href={offer.href}
              label={offer.label}
              network={offer.network}
              item={item}
              disclosure={offer.disclosure}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Bookshop and Zazzle sit side by side once either card has a link. */
export function HomeGiftSpots({ offers = AFFILIATE_OFFERS }: { offers?: readonly AffiliateOffer[] }) {
  const spots = (["books", "gifts"] as const).filter((spot) => visibleAffiliateOffers(spot, null, offers).length > 0);
  if (spots.length === 0) return null;
  return (
    <div className={spots.length === 1 ? "partner-spot-row partner-spot-solo" : "partner-spot-row"}>
      {spots.map((spot) => (
        <AffiliateSpot key={spot} spot={spot} offers={offers} />
      ))}
    </div>
  );
}
