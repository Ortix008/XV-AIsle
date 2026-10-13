const WEEKEND = new Set([0, 6]);

/** `YYYY-MM-DD` dates from a comma-separated list. Invalid dates are dropped. */
export function parseHolidayList(raw: string | undefined | null) {
  const holidays = new Set<string>();
  if (!raw) return holidays;
  for (const part of raw.split(",")) {
    const stamp = part.trim();
    if (isISODate(stamp)) holidays.add(stamp);
  }
  return holidays;
}

/** Holidays the 7-business-day delay check skips, besides weekends. */
export function storeHolidays() {
  return parseHolidayList(process.env.STORE_HOLIDAYS);
}

/**
 * End of the UTC day that is `days` business days after `fromMs`.
 * Weekends are skipped. Dates in `holidays` (`YYYY-MM-DD`, UTC) are skipped too.
 */
export function addBusinessDaysSkipping(fromMs: number, days: number, holidays?: ReadonlySet<string>) {
  const skip = holidays ?? new Set<string>();
  const start = new Date(fromMs);
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  let left = days;
  if (!Number.isInteger(left) || left < 1) left = 1;
  while (left > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (WEEKEND.has(cursor.getUTCDay())) continue;
    if (skip.has(businessDayStamp(cursor.getTime()))) continue;
    left -= 1;
  }
  cursor.setUTCHours(23, 59, 59, 999);
  return cursor.getTime();
}

/** End of the UTC day that is `days` business days after `fromMs`. Weekends are skipped. */
export function addBusinessDays(fromMs: number, days: number) {
  return addBusinessDaysSkipping(fromMs, days);
}

/** Promised ship-by instant. A missing or zero window means 7 business days. */
export function shipDeadline(paidAt: number, shipDaysMax: number | null | undefined) {
  const window = shipDaysMax && shipDaysMax > 0 ? shipDaysMax : 7;
  return addBusinessDays(paidAt, window);
}

export function isISODate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function businessDayStamp(ms: number) {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatISODate(iso: string) {
  if (!isISODate(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
