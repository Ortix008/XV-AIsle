/** Longest delivery window before the desk warns an operator. */
export const DELIVERY_WARN_BUSINESS_DAYS = 7;

/** A person answers a shopper note inside this many hours. */
export const REPLY_WITHIN_HOURS = 24;

export const HOW_WE_CHECK_HREF = "/shop/how-we-check";

const COMPARE_AT_KEYS = new Set([
  "compareat",
  "compareatprice",
  "compareatcents",
  "compareatpricecents",
  "strikeprice",
  "strikepricecents",
  "strikethrough",
  "strikethroughprice",
  "wasprice",
  "waspricecents",
  "originalprice",
  "originalpricecents",
  "regularprice",
  "regularpricecents",
  "listprice",
  "listpricecents",
  "msrp",
  "msrpcents",
]);

const STRIKE_COPY = [
  /<\s*\/?\s*(s|del|strike)\b/i,
  /line-through/i,
  /~~[^~\n]*\$\s*\d/,
  /\bcompare[\s-]?at\b/i,
  /\bstrike[\s-]?through\b/i,
  /\bwas\s+\$\s*\d/i,
  /\bregular\s+price\b/i,
  /\blist\s+price\b/i,
];

function flatKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function compareAtRejection(value: unknown): string | null {
  const found = findCompareAt(value);
  if (!found) return null;
  return "This store does not take a compare-at or strike-through price.";
}

function findCompareAt(value: unknown): boolean {
  if (typeof value === "string") return STRIKE_COPY.some((pattern) => pattern.test(value));
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => findCompareAt(item));
  for (const [key, nested] of Object.entries(value)) {
    if (COMPARE_AT_KEYS.has(flatKey(key))) return true;
    if (findCompareAt(nested)) return true;
  }
  return false;
}

export function deliveryExceedsWindow(input: { shipDaysMax?: number | null; deliveryTime?: string | null }) {
  if (typeof input.shipDaysMax === "number" && input.shipDaysMax > DELIVERY_WARN_BUSINESS_DAYS) return true;
  const numbers = (input.deliveryTime ?? "").match(/\d+/g)?.map(Number) ?? [];
  return numbers.some((value) => value > DELIVERY_WARN_BUSINESS_DAYS);
}

export function formatCheckDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
