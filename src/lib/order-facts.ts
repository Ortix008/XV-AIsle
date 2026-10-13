/** Arrival copy from fields that are actually stored. A blank listing gets no ETA. */
export function etaFromListing(
  listing: { deliveryTime?: string | null; shipDaysMin?: number | null; shipDaysMax?: number | null } | null | undefined,
) {
  const written = listing?.deliveryTime?.trim() ?? "";
  if (written) return written;
  const max = listing?.shipDaysMax ?? 0;
  const min = listing?.shipDaysMin ?? 0;
  if (!max || max <= 0) return null;
  if (min > 0 && min !== max) return `Ships in ${min}-${max} business days.`;
  return `Ships in ${max} business days.`;
}
