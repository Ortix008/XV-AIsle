import { getDb } from "@/lib/server/db";
import {
  PERSONALIZED_CLOSED,
  cleanPersonalizedText,
  personalizedPurchaseBlock,
  type PersonalizedJob,
  type PersonalizedProductionStatus,
} from "@/lib/personalized";

function productionStatus(value: string): PersonalizedProductionStatus {
  switch (value) {
    case "new":
    case "in_production":
    case "ready":
    case "shipped":
      return value;
    default:
      return "new";
  }
}

export function listPersonalizedJobs(): PersonalizedJob[] {
  const rows = getDb()
    .prepare(
      `SELECT id, order_id, design_id, design_version, custom_text, material, color, size_label, qty,
              production_status, carrier, tracking_number
       FROM personalized_jobs
       ORDER BY created_at`,
    )
    .all() as {
    id: string;
    order_id: string | null;
    design_id: string | null;
    design_version: string | null;
    custom_text: string;
    material: string | null;
    color: string | null;
    size_label: string | null;
    qty: number;
    production_status: string;
    carrier: string | null;
    tracking_number: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    orderId: row.order_id,
    designId: row.design_id ?? "",
    designVersion: row.design_version ?? "",
    customText: row.custom_text,
    material: row.material,
    color: row.color,
    sizeLabel: row.size_label,
    qty: row.qty,
    productionStatus: productionStatus(row.production_status),
    carrier: row.carrier,
    trackingNumber: row.tracking_number,
  }));
}

/** Validates the letters, then refuses. It does not write a row. */
export function savePersonalizedJob(input: { customText: string }) {
  const text = cleanPersonalizedText(input.customText);
  if ("error" in text) return { error: text.error };
  return { error: personalizedPurchaseBlock() ?? PERSONALIZED_CLOSED };
}
