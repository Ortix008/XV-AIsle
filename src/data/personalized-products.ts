export type PersonalizedKind = "physical" | "digital";

export type PersonalizedLettering = {
  label: string;
  maxChars: number;
};

export type PersonalizedProduct = {
  id: string;
  title: string;
  kind: PersonalizedKind;
  priceCents: number;
  packSize: number | null;
  summary: string;
  productionBusinessDays: { min: number; max: number } | null;
  lettering: PersonalizedLettering | null;
};

/**
 * Intended prices for these exact items. None of them can be purchased until
 * artwork rights, original files, postage, and a payment path are verified.
 */
export const personalizedProducts: readonly PersonalizedProduct[] = [
  {
    id: "happy-camper-gable-boxes",
    title: "One Happy Camper Gable Boxes",
    kind: "physical",
    priceCents: 3000,
    packSize: 6,
    summary: "Empty cardstock boxes, packed flat. The name and age are the same on all six.",
    productionBusinessDays: { min: 5, max: 7 },
    lettering: { label: "Name and age", maxChars: 30 },
  },
  {
    id: "happy-camper-cake-topper",
    title: "One Happy Camper Cake Topper",
    kind: "physical",
    priceCents: 2500,
    packSize: null,
    summary: "A physical three-dimensional shaker, about 8 by 8 inches.",
    productionBusinessDays: { min: 5, max: 7 },
    lettering: { label: "Name and age", maxChars: 30 },
  },
  {
    id: "happy-camper-cupcake-toppers",
    title: "One Happy Camper Cupcake Toppers",
    kind: "physical",
    priceCents: 1800,
    packSize: 14,
    summary: "A set of 14.",
    productionBusinessDays: null,
    lettering: null,
  },
  {
    id: "happy-camper-party-bundle",
    title: "One Happy Camper Party Bundle",
    kind: "physical",
    priceCents: 6500,
    packSize: null,
    summary: "What is inside this bundle is not on file.",
    productionBusinessDays: null,
    lettering: null,
  },
  {
    id: "little-pumpkin-cake-topper",
    title: "Our Little Pumpkin Cake Topper",
    kind: "physical",
    priceCents: 1700,
    packSize: null,
    summary: "A physical cake topper.",
    productionBusinessDays: null,
    lettering: null,
  },
  {
    id: "lucky-duck-cake-topper-girl",
    title: "One Lucky Duck Cake Topper Girl",
    kind: "physical",
    priceCents: 2500,
    packSize: null,
    summary: "A physical cake topper.",
    productionBusinessDays: null,
    lettering: null,
  },
  {
    id: "lucky-duck-cake-topper-boy",
    title: "One Lucky Duck Cake Topper Boy",
    kind: "physical",
    priceCents: 2500,
    packSize: null,
    summary: "A physical cake topper.",
    productionBusinessDays: null,
    lettering: null,
  },
  {
    id: "little-pumpkin-website-invitation",
    title: "Our Little Pumpkin Interactive Website Invitation",
    kind: "digital",
    priceCents: 1800,
    packSize: null,
    summary: "Described as two PDF files, a template and a guide. Those files are not on this site. This item is not shipped.",
    productionBusinessDays: null,
    lettering: null,
  },
];

export function personalizedProduct(id: string) {
  return personalizedProducts.find((item) => item.id === id) ?? null;
}

/** These ids stay unsellable even if a purchase flag is turned on. */
export function personalizedCheckoutBlock(productId: string) {
  if (!personalizedProduct(productId)) return null;
  return "Personalized orders are not open.";
}

/** The price a future ticket would freeze. A client amount is not accepted. */
export function personalizedPriceSnapshot(productId: string) {
  const product = personalizedProduct(productId);
  if (!product) return null;
  return {
    productId: product.id,
    title: product.title,
    kind: product.kind,
    priceCents: product.priceCents,
    packSize: product.packSize,
  };
}
