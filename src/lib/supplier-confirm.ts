const SWITCH_OFF = new Set(["0", "false", "off", "no"]);

/** Unset means on. Explicit 0, false, off, or no means off. */
export function requireSupplierConfirmed(value = process.env.REQUIRE_SUPPLIER_CONFIRMED) {
  const flag = value?.trim().toLowerCase() ?? "";
  if (!flag) return true;
  return !SWITCH_OFF.has(flag);
}
