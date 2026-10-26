import { usSupplierConfirmed, type ShipSource } from "./order-facts";

const SWITCH_OFF = new Set(["0", "false", "off", "no"]);

/** Unset means on. Explicit 0, false, off, or no means off. */
export function requireSupplierConfirmed(value = process.env.REQUIRE_SUPPLIER_CONFIRMED) {
  const flag = value?.trim().toLowerCase() ?? "";
  if (!flag) return true;
  return !SWITCH_OFF.has(flag);
}

/** Coming soon: the switch is on, and the row is not a confirmed US ship-from. */
export function comingSoonListing(listing: ShipSource) {
  if (!requireSupplierConfirmed()) return false;
  return !usSupplierConfirmed(listing);
}
