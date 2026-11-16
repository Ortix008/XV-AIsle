import { ExternalLink } from "lucide-react";
import {
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
    <span className="affiliate-spot-link">
      <a className="affiliate-spot-anchor" href={href} rel="sponsored noopener noreferrer" target="_blank">
        {label}
        <ExternalLink className="affiliate-spot-icon" aria-hidden />
      </a>
      <span className="affiliate-spot-note">{affiliateDisclosure(disclosure)}</span>
    </span>
  );
}
