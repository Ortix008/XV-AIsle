import type { Metadata } from "next";
import { publicSiteUrl } from "@/lib/config/env";

export const SHARE_IMAGE_ALT =
  "XV-AIsle wordmark over a dimly lit aisle of shelves with glowing lanterns. A curated US market for home, kitchen and everyday goods.";

export function shareCard() {
  return {
    url: `${publicSiteUrl()}/og/og-image.png`,
    width: 1200,
    height: 630,
    alt: SHARE_IMAGE_ALT,
    card: "summary_large_image" as const,
  };
}

export function shareCardMetadata(): Pick<Metadata, "metadataBase" | "openGraph" | "twitter"> {
  const card = shareCard();
  return {
    metadataBase: new URL(publicSiteUrl()),
    openGraph: {
      images: [{ url: card.url, width: card.width, height: card.height, alt: card.alt }],
    },
    twitter: {
      card: card.card,
      images: [{ url: card.url, alt: card.alt }],
    },
  };
}
