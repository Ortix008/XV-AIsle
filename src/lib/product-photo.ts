export type PhotoBox = { width: number; height: number };

/** Intrinsic pixels of the draft product photos. The JPEG files are the source. */
export const PRODUCT_PHOTO_SIZE: Record<string, PhotoBox> = {
  "/art/products/christmas-tree-cat-house-flag.jpg": { width: 1100, height: 1486 },
  "/art/products/garnet-jewelry-gift-set.jpg": { width: 1024, height: 1024 },
  "/art/products/insulated-dog-raincoat-dark-blue.jpg": { width: 2000, height: 2000 },
  "/art/products/pearl-jewelry-gift-set.jpg": { width: 1920, height: 1920 },
  "/art/products/reversible-dog-raincoat-green.jpg": { width: 1100, height: 1100 },
};

export function productPhotoSize(src: string | null | undefined): PhotoBox | null {
  if (!src) return null;
  return PRODUCT_PHOTO_SIZE[src] ?? null;
}
