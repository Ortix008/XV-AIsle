/**
 * Supplier records with evidence. Leave this empty until a record is real.
 * Do not add a title, price, supplier, or ship window as a placeholder.
 */
export type SourcedOfferStatus = "unverified" | "fulfillment" | "affiliate";

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
};

export const sourcedOfferInputs: readonly SourcedOfferInput[] = [];
