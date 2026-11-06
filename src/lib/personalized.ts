export const PERSONALIZED_PURCHASES_OPEN = false;

export const PERSONALIZED_CLOSED = "Personalized orders are not open.";

export const PERSONALIZED_TEXT_MAX = 40;

export type PersonalizedProductionStatus = "new" | "in_production" | "ready" | "shipped";

export type PersonalizedJob = {
  id: string;
  orderId: string | null;
  designId: string;
  designVersion: string;
  customText: string;
  material: string | null;
  color: string | null;
  sizeLabel: string | null;
  qty: number;
  productionStatus: PersonalizedProductionStatus;
  carrier: string | null;
  trackingNumber: string | null;
};

export const personalizedPlaceholders = [
  { kind: "size", label: "Size", available: false },
  { kind: "material", label: "Material", available: false },
  { kind: "color", label: "Color", available: false },
] as const;

/** Approved preset designs. Empty until the owner supplies a design and the right to sell it. */
export const approvedDesigns: readonly { id: string; version: string; name: string }[] = [];

export function cleanPersonalizedText(value: string) {
  const text = value.replace(/[\u0000-\u001f\u007f]/g, "").trim().replace(/\s+/g, " ");
  if (!text) return { error: "Add the name or monogram." as const };
  if (text.length > PERSONALIZED_TEXT_MAX) return { error: `Use ${PERSONALIZED_TEXT_MAX} characters or fewer.` as const };
  return { text };
}

export function personalizedPurchaseBlock() {
  if (PERSONALIZED_PURCHASES_OPEN) return null;
  return PERSONALIZED_CLOSED;
}

/** Printable handoff. It has no buyer name, email, or street. */
export function formatJobSheet(job: PersonalizedJob) {
  const lines = [
    `Job ${job.id}`,
    job.orderId ? `Order ${job.orderId}` : "Order not paid",
    `Design ${job.designId} version ${job.designVersion}`,
    `Text ${job.customText}`,
    `Material ${job.material ?? "not supplied"}`,
    `Color ${job.color ?? "not supplied"}`,
    `Size ${job.sizeLabel ?? "not supplied"}`,
    `Quantity ${job.qty}`,
    `Production ${job.productionStatus}`,
    `Carrier ${job.carrier ?? "not supplied"}`,
    `Tracking ${job.trackingNumber ?? "not supplied"}`,
  ];
  return lines.join("\n");
}
