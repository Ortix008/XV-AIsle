/** Shopper title and description until product copy is approved. */
export const POD_COPY_TODO = "TODO(copy)";

export type PodShelfItem = {
  productId: string;
  sku: string;
  /** Factual product name. No pitch, ship time, or origin. */
  name: string;
  /** Provider named in the signed-in file. Empty when that file has no matching row. */
  supplierName: string;
  /** Base cost in cents. Null when the signed-in file does not state one. */
  costCents: number | null;
  /** First-item US shipping in cents. Null when the signed-in file does not state one. */
  shippingCents: number | null;
  /** Which signed-in file supplied the cost and shipping. Null when neither did. */
  source: "printful-signedin-oct26" | "printify-signedin-oct26" | null;
};

export function podPlaceholder(name: string) {
  return `${POD_COPY_TODO} ${name}`;
}

/**
 * The Oct 26 shelf: the draft list of 25, without the ceramic ornament.
 * Cost and first-item shipping come only from the signed-in Printful and Printify files.
 * Those files do not give a retail price, so none is stored.
 */
export const podShelfItems: PodShelfItem[] = [
  { productId: "pod-white-glossy-mug-11oz", sku: "pod-white-glossy-mug-11oz", name: "White glossy mug 11oz", supplierName: "Printful", costCents: 607, shippingCents: 669, source: "printful-signedin-oct26" },
  { productId: "pod-tapered-tumbler-20oz", sku: "pod-tapered-tumbler-20oz", name: "Tapered stainless tumbler 20oz", supplierName: "Printful", costCents: 2497, shippingCents: 669, source: "printful-signedin-oct26" },
  { productId: "pod-throw-blanket-50x60", sku: "pod-throw-blanket-50x60", name: "Throw blanket 50x60", supplierName: "Printful", costCents: 2936, shippingCents: 829, source: "printful-signedin-oct26" },
  { productId: "pod-pet-collar", sku: "pod-pet-collar", name: "Pet collar", supplierName: "Printful", costCents: 1757, shippingCents: 419, source: "printful-signedin-oct26" },
  { productId: "pod-luggage-tag", sku: "pod-luggage-tag", name: "Luggage tag", supplierName: "Printful", costCents: 1346, shippingCents: 619, source: "printful-signedin-oct26" },
  { productId: "pod-crossbody-bag", sku: "pod-crossbody-bag", name: "AOP Utility Crossbody Bag", supplierName: "Printful", costCents: 2223, shippingCents: 469, source: "printful-signedin-oct26" },
  { productId: "pod-framed-poster-8x10", sku: "pod-framed-poster-8x10", name: "Framed matte poster 8x10", supplierName: "Printful", costCents: 2076, shippingCents: 1089, source: "printful-signedin-oct26" },
  { productId: "pod-wooden-bell-ornament", sku: "pod-wooden-bell-ornament", name: "Wooden ornament (bell)", supplierName: "Printful", costCents: 837, shippingCents: 519, source: "printful-signedin-oct26" },
  { productId: "pod-holiday-pillow-18x18", sku: "pod-holiday-pillow-18x18", name: "Holiday throw pillow 18x18 w/ insert", supplierName: "Printful", costCents: 1868, shippingCents: 1089, source: "printful-signedin-oct26" },
  { productId: "pod-holiday-lumbar-20x12", sku: "pod-holiday-lumbar-20x12", name: "Holiday lumbar pillow 20x12 w/ insert", supplierName: "Printful", costCents: 1764, shippingCents: 1089, source: "printful-signedin-oct26" },
  { productId: "pod-gaming-mouse-pad", sku: "pod-gaming-mouse-pad", name: "Gaming mouse pad 18x16", supplierName: "", costCents: null, shippingCents: null, source: null },
  { productId: "pod-canvas-tote", sku: "pod-canvas-tote", name: "Cotton canvas tote", supplierName: "", costCents: null, shippingCents: null, source: null },
  { productId: "pod-pillow-14x14", sku: "pod-pillow-14x14", name: "Spun-poly pillow 14x14", supplierName: "MWW On Demand", costCents: 1667, shippingCents: 1019, source: "printify-signedin-oct26" },
  { productId: "pod-enamel-mug-12oz", sku: "pod-enamel-mug-12oz", name: "Enamel camping mug 12oz", supplierName: "Printful", costCents: 1355, shippingCents: 479, source: "printify-signedin-oct26" },
  { productId: "pod-matte-poster-8x10", sku: "pod-matte-poster-8x10", name: "Matte poster 8x10", supplierName: "Today's Graphics", costCents: 515, shippingCents: 739, source: "printify-signedin-oct26" },
  { productId: "pod-fleece-blanket-50x60", sku: "pod-fleece-blanket-50x60", name: "Arctic fleece blanket 50x60", supplierName: "District Photo", costCents: 2463, shippingCents: 1039, source: "printify-signedin-oct26" },
  { productId: "pod-lined-journal", sku: "pod-lined-journal", name: "Hardcover lined journal", supplierName: "District Photo", costCents: 1059, shippingCents: 619, source: "printify-signedin-oct26" },
  { productId: "pod-crew-socks", sku: "pod-crew-socks", name: "Sublimation crew socks", supplierName: "Pic The Gift", costCents: 747, shippingCents: 529, source: "printify-signedin-oct26" },
  { productId: "pod-canvas-6x6", sku: "pod-canvas-6x6", name: "Stretched canvas 6x6", supplierName: "Jondo", costCents: 1250, shippingCents: 1189, source: "printify-signedin-oct26" },
  { productId: "pod-water-bottle-18oz", sku: "pod-water-bottle-18oz", name: "Stainless water bottle 18oz", supplierName: "WOYC", costCents: 2619, shippingCents: 729, source: "printify-signedin-oct26" },
  { productId: "pod-weekender-bag", sku: "pod-weekender-bag", name: "Weekender bag 13x24", supplierName: "MWW On Demand", costCents: 3163, shippingCents: 799, source: "printify-signedin-oct26" },
  { productId: "pod-wall-tapestry-26x36", sku: "pod-wall-tapestry-26x36", name: "Wall tapestry 26x36", supplierName: "MWW On Demand", costCents: 1678, shippingCents: 559, source: "printify-signedin-oct26" },
  { productId: "pod-wall-calendar-2027", sku: "pod-wall-calendar-2027", name: "2027 wall calendar", supplierName: "District Photo", costCents: 1122, shippingCents: 779, source: "printify-signedin-oct26" },
  { productId: "pod-journal-mug-set", sku: "pod-journal-mug-set", name: "Hardcover journal + 11oz mug", supplierName: "", costCents: null, shippingCents: null, source: null },
];
