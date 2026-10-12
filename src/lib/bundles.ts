import { compareAtRejection } from "./honest-price";

const SAVINGS_COPY = [/\byou save\b/i, /\bsave\s+\$/i, /\bsavings\b/i, /\bdiscount\b/i, /\d+\s*%\s*off\b/i];

function findSavings(value: unknown): boolean {
  if (typeof value === "string") return SAVINGS_COPY.some((pattern) => pattern.test(value));
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => findSavings(item));
  return Object.values(value).some((nested) => findSavings(nested));
}

/** A bundle has one admin price. It cannot carry a compare-at price or a savings claim. */
export function bundlePriceRejection(value: unknown): string | null {
  const compareAt = compareAtRejection(value);
  if (compareAt) return compareAt;
  if (findSavings(value)) return "A bundle has one price. It does not claim a savings.";
  return null;
}
