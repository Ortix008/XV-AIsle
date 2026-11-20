import { ExternalLink } from "lucide-react";
import {
  PARTNER_CARD_NAME,
  affiliateDisclosure,
  affiliateLinkVisible,
  type AffiliateItem,
  type AffiliateNetwork,
} from "@/config/affiliates";

export function AffiliateLink({
  href,
  label,
  network,
  item,
  disclosure,
}: {
  href: string;
  label: string;
  network: AffiliateNetwork;
  item?: AffiliateItem | null;
  disclosure?: string | null;
}) {
  if (!affiliateLinkVisible({ href, network, item })) return null;
  return (
    <article className="partner-card">
      <p className="partner-card-name">{PARTNER_CARD_NAME[network]}</p>
      <a className="partner-card-cta" href={href} rel="sponsored noopener noreferrer" target="_blank">
        {label}
        <ExternalLink className="partner-card-icon" aria-hidden />
      </a>
      <p className="partner-card-disclosure">{affiliateDisclosure(disclosure)}</p>
    </article>
  );
}
