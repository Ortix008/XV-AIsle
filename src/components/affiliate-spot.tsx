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
  const books = visibleAffiliateOffers("books", null, offers);
  const gifts = visibleAffiliateOffers("gifts", null, offers);
  if (books.length === 0 && gifts.length === 0) return null;
  return (
    <div className="partner-spot-row">
      <AffiliateSpot spot="books" offers={offers} />
      <AffiliateSpot spot="gifts" offers={offers} />
    </div>
  );
}
