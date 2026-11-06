/**
 * Supplier records with evidence. A pending record is not a price and not a
 * promise that XV-AIsle can ship it.
 */
export type SourcedOfferStatus = "unverified" | "supplier_pending" | "fulfillment" | "affiliate";

export type SourceVariant = {
  code: string;
  label: string;
};

export type SourceCitation = {
  href: string;
  text: string;
};

export type SourcedOfferInput = {
  id: string;
  title: string;
  status: SourcedOfferStatus;
  note?: string;
  image?: string;
  listingId?: string;
  affiliateHref?: string;
  affiliateApproved?: boolean;
  category?: string;
  /** Source site's published retail figure, in cents. Never a charge on this store. */
  sourceRetailCents?: number;
  variants?: SourceVariant[];
  citations?: SourceCitation[];
};

const PRODUCT = "https://mltools.com/products/mltools-tool-drawer-organizer-tray-10-compartment-home-garage-tool-tray";

export const sourcedOfferInputs: readonly SourcedOfferInput[] = [
  {
    id: "mltools-ot10",
    title: "MLTOOLS Tool Drawer Organizer Tray, 10-compartment",
    status: "supplier_pending",
    category: "tools",
    note: "Supplier pending. XV-AIsle has no account with MLTOOLS and has not agreed to a cost.",
    sourceRetailCents: 1899,
    variants: [
      { code: "OT10R", label: "Red" },
      { code: "OT10B", label: "Black" },
    ],
    citations: [
      {
        href: PRODUCT,
        text: "Product page. Its schema was observed as InStock on Nov 6, 2026. That is the source site, not XV-AIsle stock. Published retail reference is $18.99.",
      },
      {
        href: "https://mltools.com/pages/drop-shipping",
        text: "Drop-shipping page: blind, plain packaging. It says processed and shipped in 24–48 hours from a US-based facility. No city is named.",
      },
      {
        href: "https://mltools.com/policies/shipping-policy",
        text: "Consumer shipping policy: free shipping in the lower 48, and ship within 2 business days after that site is paid. A partner cost is not stated.",
      },
      {
        href: "https://mltools.com/policies/refund-policy",
        text: "Refund policy says 30 days. The return street on that page is an unfilled placeholder. Who pays the return is not stated.",
      },
      {
        href: "https://mltools.com/pages/about-us",
        text: "About page lists Mountain House, CA as the business. That is not established as the warehouse. The page also mentions overseas warehousing.",
      },
    ],
  },
];
