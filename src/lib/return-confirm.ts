export const CONFIRMING_PAYMENT = "Confirming payment…";
export const PAYMENT_UNCONFIRMED = "Payment was not confirmed.";
export const CONFIRM_POLL_MS = 2000;
export const CONFIRM_GIVE_UP_MS = 20000;

export type ConfirmPayload = {
  error?: string;
  pending?: boolean;
  order?: { supplierDetail?: string | null } | null;
  summary?: Record<string, unknown> | null;
};

export type ConfirmStep =
  | { kind: "paid"; detail: string; summary: Record<string, unknown> }
  | { kind: "pending" }
  | { kind: "error"; message: string };

/** One checkout response. A paid order stops. A not-yet-paid response keeps waiting. */
export function confirmStep(status: number, body: ConfirmPayload | null): ConfirmStep {
  if (body?.summary && typeof body.summary === "object") {
    const detail = body.order?.supplierDetail?.trim() || "The supplier has the order.";
    return { kind: "paid", detail, summary: body.summary };
  }
  if (status === 202 || body?.pending) return { kind: "pending" };
  if (status >= 400 && status !== 502 && status !== 503) {
    return { kind: "error", message: body?.error || PAYMENT_UNCONFIRMED };
  }
  if (status >= 500 || body?.error) return { kind: "pending" };
  return { kind: "pending" };
}

/** Lede while the return page is still waiting, including after the give-up. */
export function confirmLede(step: ConfirmStep | null, elapsedMs: number) {
  if (step?.kind === "paid") return step.detail;
  if (step?.kind === "error") return step.message;
  if (elapsedMs >= CONFIRM_GIVE_UP_MS) return PAYMENT_UNCONFIRMED;
  return CONFIRMING_PAYMENT;
}
