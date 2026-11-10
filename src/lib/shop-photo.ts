/**
 * A shop card has no real photo when the listing has no image, or when the
 * image is the shared fallback the frame uses instead of a product picture.
 * The mark is what an empty frame draws. The pedestal photo is the glowing
 * aisle plate, not a product.
 */
export const SHOP_PLACEHOLDER_PHOTOS = ["/xv-aisle-mark.svg", "/brand/hero-aisle-pedestals.webp"] as const;

export function hasRealProductPhoto(image: string | null | undefined) {
  const photo = image?.trim() ?? "";
  if (!photo) return false;
  const path = photo.split(/[?#]/)[0];
  return !SHOP_PLACEHOLDER_PHOTOS.some((asset) => path === asset);
}

export function shopCardsWithPhotos<T extends { image?: string | null }>(cards: readonly T[]) {
  return cards.filter((card) => hasRealProductPhoto(card.image));
}
