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
    <section className="affiliate-spot">
      <h2 className="affiliate-spot-heading">{AFFILIATE_SPOT_HEADING[spot]}</h2>
      <ul className="affiliate-spot-list">
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
