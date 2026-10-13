import { etaFromListing } from "./order-facts";
import { charm, landedCost, suggestRetail, TARGET_MARGIN } from "./money";

/** Obvious stand-in. Not a street, city, or ZIP the store ships to. */
export const SAMPLE_RETURN_ADDRESS = "100 Example Street\nSample City, ST 00000\nUS";

/** Checkout session id the preview seed inserts. It is not a Stripe id. */
export const PREVIEW_CHECKOUT_SESSION = "cs_preview_sample_sheet_pan";

export type SampleStarter = {
  productId: string;
  sku: string;
  title: string;
  description: string;
  image: string;
  supplierName: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  unitCost: number;
  inboundShipping: number;
  packaging: number;
};

export const sampleStarters: SampleStarter[] = [
  {
    productId: "sheet-pan",
    sku: "LN-PAN-Q",
    title: "Quarter sheet pan and rack",
    description: "One pan, one rack. The rack keeps the chicken out of the fat.",
    image: "/art/mock-sheet-pan-1.png",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    unitCost: 11,
    inboundShipping: 0,
    packaging: 1.2,
  },
  {
    productId: "bench-scraper",
    sku: "LN-SCR-1",
    title: "Stainless bench scraper",
    description: "Cut dough, lift chopped onion, scrape the board into the pan.",
    image: "/art/mock-bench-scraper-1.png",
    supplierName: "Northwharf Goods",
    supplierOrigin: "Elizabeth, NJ",
    shipDaysMin: 2,
    shipDaysMax: 4,
    unitCost: 3.4,
    inboundShipping: 0,
    packaging: 0.35,
  },
];

export function samplePriceCents(item: Pick<SampleStarter, "unitCost" | "inboundShipping" | "packaging">) {
  const landed = landedCost(item);
  return Math.round(charm(suggestRetail(landed, TARGET_MARGIN)) * 100);
}

export function sampleSheetPan() {
  const item = sampleStarters.find((starter) => starter.productId === "sheet-pan");
  if (!item) throw new Error("The sample shelf has no sheet pan.");
  return item;
}

/** Receipt preview facts taken from the sample shelf. The return address is a placeholder. */
export function sampleReceiptFacts() {
  const item = sampleSheetPan();
  return {
    productId: item.productId,
    title: item.title,
    amountCents: samplePriceCents(item),
    eta: etaFromListing(item),
    returnAddress: SAMPLE_RETURN_ADDRESS,
  };
}
