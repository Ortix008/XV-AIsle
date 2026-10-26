/** Existing stand-in picture. These rows do not have approved photos. */
export const POD_PLACEHOLDER_IMAGE = "/art/mock-sheet-pan-1.png";

/** Shopper title and description until product copy is approved. */
export const POD_COPY_TODO = "TODO(copy)";

export type PodShelfItem = {
  productId: string;
  sku: string;
  /** Factual product name from the batch file. No pitch, ship time, or origin. */
  name: string;
  priceCents: number;
  /** Provider named in the batch file, with no country or city. */
  supplierName: string;
};

export function podPlaceholder(name: string) {
  return `${POD_COPY_TODO} ${name}`;
}

/**
 * Rows the Oct 26 batch file marks Yes, All pass, or PASS.
 * Prices are the file's retail prices, in cents.
 */
export const podShelfItems: PodShelfItem[] = [
  { productId: "pod-white-glossy-mug-11oz", sku: "POD-MUG-11", name: "White glossy mug 11oz", priceCents: 2199, supplierName: "Printful" },
  { productId: "pod-tapered-tumbler-20oz", sku: "POD-TUM-20", name: "Tapered stainless tumbler 20oz", priceCents: 4499, supplierName: "Printful" },
  { productId: "pod-pet-bowl-18oz", sku: "POD-BOWL-18", name: "Pet bowl 18oz", priceCents: 4499, supplierName: "Printful" },
  { productId: "pod-gaming-mouse-pad", sku: "POD-PAD-1816", name: "Gaming mouse pad 18×16", priceCents: 3499, supplierName: "Printful" },
  { productId: "pod-canvas-tote", sku: "POD-TOTE", name: "Cotton canvas tote", priceCents: 2499, supplierName: "Printify Choice" },
  { productId: "pod-pillow-14x14", sku: "POD-PIL-14", name: "Spun-poly pillow 14×14", priceCents: 3999, supplierName: "Printify Choice" },
  { productId: "pod-ceramic-ornament", sku: "POD-ORN", name: "Ceramic ornament 1-sided", priceCents: 2199, supplierName: "Printify Choice" },
  { productId: "pod-jigsaw-8x10", sku: "POD-PUZ-810", name: "Jigsaw puzzle w/ tin 8×10", priceCents: 3499, supplierName: "Printify Choice" },
  { productId: "pod-enamel-mug-12oz", sku: "POD-EMUG-12", name: "Enamel camping mug 12oz", priceCents: 2999, supplierName: "Printful" },
  { productId: "pod-tea-towel", sku: "POD-TWL-1628", name: "Hand/tea towel 16×28", priceCents: 2499, supplierName: "Printify Choice" },
  { productId: "pod-lined-journal", sku: "POD-JNL", name: "Hardcover lined journal", priceCents: 2499, supplierName: "District Photo" },
  { productId: "pod-matte-poster-8x10", sku: "POD-PST-810", name: "Matte poster 8×10", priceCents: 2499, supplierName: "Today's Graphics" },
  { productId: "pod-aop-apron", sku: "POD-APRON", name: "All-over-print apron", priceCents: 3999, supplierName: "MWW On Demand" },
  { productId: "pod-fleece-blanket-50x60", sku: "POD-FLC-5060", name: "Arctic fleece blanket 50×60", priceCents: 4499, supplierName: "Printify Choice" },
  { productId: "pod-weekender-bag", sku: "POD-WEEK", name: "Weekender bag 13×24", priceCents: 5999, supplierName: "Printify Choice" },
  { productId: "pod-crew-socks", sku: "POD-SOCK", name: "Sublimation crew socks", priceCents: 2199, supplierName: "SPOKE Custom Products" },
  { productId: "pod-canvas-6x6", sku: "POD-CAN-66", name: "Stretched canvas 6×6", priceCents: 3499, supplierName: "Roma Imaging" },
  { productId: "pod-laptop-sleeve-13", sku: "POD-SLV-13", name: 'Laptop sleeve 13"', priceCents: 3999, supplierName: "SPOKE Custom Products" },
  { productId: "pod-water-bottle-17oz", sku: "POD-BTL-17", name: "Stainless water bottle 17oz", priceCents: 5499, supplierName: "Printful" },
  { productId: "pod-crossbody-bag", sku: "POD-XBODY", name: "AOP Utility Crossbody Bag", priceCents: 4499, supplierName: "Printful" },
  { productId: "pod-framed-poster-8x10", sku: "POD-FRM-810", name: "Framed matte poster 8x10", priceCents: 4999, supplierName: "Printful" },
  { productId: "pod-wall-tapestry-26x36", sku: "POD-TAP-2636", name: "Wall tapestry 26x36", priceCents: 3999, supplierName: "MWW On Demand" },
];
