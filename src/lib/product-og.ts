import { publicImageSize } from "./image-size";
import { shareCard } from "./share-card";

export type ProductOgImage = {
  url: string;
  width: number;
  height: number;
  alt: string;
};

function absolute(origin: string, image: string) {
  if (image.startsWith("https://") || image.startsWith("http://")) return image;
  return `${origin}${image.startsWith("/") ? image : `/${image}`}`;
}

/** Open Graph image for a product. A local file uses its real pixel size. Anything else uses the 1200×630 site card. */
export function productOgImage(origin: string, image: string, alt: string): ProductOgImage {
  const path = image.trim();
  const local = path.startsWith("/") ? publicImageSize(path) : null;
  if (local) {
    return { url: absolute(origin, path), width: local.width, height: local.height, alt };
  }
  const card = shareCard();
  return { url: card.url, width: card.width, height: card.height, alt: card.alt };
}
