import { ExternalLink } from "lucide-react";
import {
  PARTNER_CARD_NAME,
  affiliateDisclosure,
  affiliateLinkVisible,
  type AffiliateItem,
  type AffiliateNetwork,
} from "@/config/affiliates";

function labelWithIcon(label: string) {
  const words = label.trim().split(/\s+/);
  const last = words.pop() ?? "";
  const lead = words.join(" ");
  return (
    <>
      {lead ? <>{lead} </> : null}
      <span className="partner-card-cta-keep">
        {last}
        <ExternalLink className="partner-card-icon" aria-hidden />
      </span>
    </>
  );
}

export function AffiliateLink({
  href,
  label,
  network,
  item,
  disclosure,
  heading,
  blurb,
}: {
  href: string;
  label: string;
  network: AffiliateNetwork;
  item?: AffiliateItem | null;
  disclosure?: string | null;
  heading?: string;
  blurb?: string;
}) {
  if (!affiliateLinkVisible({ href, network, item })) return null;
  return (
    <article className="partner-card">
      <p className="partner-card-name">{PARTNER_CARD_NAME[network]}</p>
      {heading ? <h3 className="affiliate-card-name">{heading}</h3> : null}
      {blurb ? <p className="affiliate-blurb">{blurb}</p> : null}
      <a
        className="partner-card-cta"
        data-label={label}
        href={href}
        rel={
          network === "bookshop" || network === "getyourguide"
            ? "sponsored nofollow noopener noreferrer"
            : "sponsored noopener noreferrer"
        }
        target="_blank"
      >
        <span className="partner-card-cta-label">{labelWithIcon(label)}</span>
      </a>
      <p className="partner-card-disclosure">{affiliateDisclosure(disclosure)}</p>
    </article>
  );
}
