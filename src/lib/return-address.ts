/** Buyer-facing return copy. A street is never part of this sentence. */
export const RETURNS_EMAILED = "We'll email the return address when you start a return.";

export type ReturnAddress = {
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

const PO_BOX = /\b(?:p(?:ost)?\.?\s*o(?:ffice)?\.?\s*box|post\s+office\s+box|pobox)\b/i;

export function poBoxRejection(value: string) {
  if (PO_BOX.test(value)) return "PO Box addresses are not accepted. Use the supplier's street address." as const;
  return null;
}

function line(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function parseReturnAddress(input: {
  line1?: string | null;
  city?: string | null;
  region?: string | null;
  postal?: string | null;
  country?: string | null;
}): { address: ReturnAddress } | { empty: true } | { error: string } {
  const address = {
    line1: line(input.line1),
    city: line(input.city),
    region: line(input.region),
    postal: line(input.postal),
    country: line(input.country),
  };
  const filled = [address.line1, address.city, address.region, address.postal, address.country].filter(Boolean);
  if (filled.length === 0) return { empty: true };
  if (filled.length < 5) return { error: "Add the street, city, state, ZIP, and country." };
  if (address.line1.length < 4 || address.line1.length > 120) return { error: "Add the street." };
  if (address.city.length < 2 || address.city.length > 80) return { error: "Add the city." };
  if (address.region.length < 2 || address.region.length > 40) return { error: "Add the state." };
  if (address.postal.length < 3 || address.postal.length > 12) return { error: "Add the ZIP." };
  if (address.country.length < 2 || address.country.length > 40) return { error: "Add the country." };
  for (const part of [address.line1, address.city, address.region, address.postal, address.country]) {
    const rejected = poBoxRejection(part);
    if (rejected) return { error: rejected };
  }
  if (address.country.length === 2) address.country = address.country.toUpperCase();
  return { address };
}

export function formatReturnAddress(address: ReturnAddress) {
  return [address.line1, `${address.city}, ${address.region} ${address.postal}`, address.country].join("\n");
}

export function returnAddressFromParts(
  line1: string | null | undefined,
  city: string | null | undefined,
  region: string | null | undefined,
  postal: string | null | undefined,
  country: string | null | undefined,
): ReturnAddress | null {
  const parsed = parseReturnAddress({ line1, city, region, postal, country });
  if ("address" in parsed) return parsed.address;
  return null;
}
