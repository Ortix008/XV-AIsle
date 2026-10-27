import { supportAddress } from "./signup-copy";

export const RETURNS_POLICY_HEADING = "Returns";

/** Approved returns policy. {SUPPORT_EMAIL} is filled from SUPPORT_EMAIL at read time. */
export const RETURNS_POLICY_LINES = [
  "You can return an item within 14 days of delivery.",
  "Every item ships from a US supplier or maker, and returns go straight back to them.",
  "To start a return, email us at {SUPPORT_EMAIL} with your order number. We'll email you the address to send it to.",
  "You pay return shipping, unless your item arrived damaged, defective or wrong. Then we cover it.",
  "For a damaged or defective item, email us a photo within 3 days of delivery.",
] as const;

export function returnsPolicyLines() {
  const email = supportAddress();
  return RETURNS_POLICY_LINES.map((line) => line.replaceAll("{SUPPORT_EMAIL}", email));
}

export function returnsPolicyText() {
  return [RETURNS_POLICY_HEADING, ...returnsPolicyLines()].join("\n");
}
