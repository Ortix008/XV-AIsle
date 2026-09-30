export type PublishInput = {
  productId: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  image: string;
  supplierName: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  published: boolean;
  madeInUsa?: boolean;
  shelf?: "national" | "small";
  supplierAccountId?: string;
  supplierCostCents?: number;
  supplierShippingCents?: number;
  feeBps?: number;
};

export async function publishListing(input: PublishInput) {
  const response = await fetch("/api/store/listings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (response.ok) return null;
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "The store did not take this page.";
}
