import { RETURNS_ON_ORDER, RETURNS_UNSET, formatReturnAddress, parseReturnAddress, returnAddressFromParts, type ReturnAddress } from "../return-address";
import type { Actor } from "./access";
import { verifiedAdmin } from "./access";
import { getDb } from "./db";

export type SupplierReturnChoice = {
  key: string;
  label: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

type ReturnRow = {
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

function nameKey(name: string) {
  return `name:${name.trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function readRow(key: string): ReturnAddress | null {
  const row = getDb().prepare("SELECT line1, city, region, postal, country FROM supplier_returns WHERE supplier_key = ?").get(key) as
    | ReturnRow
    | undefined;
  if (!row) return null;
  return returnAddressFromParts(row.line1, row.city, row.region, row.postal, row.country);
}

function supplierAccount(id: string) {
  return getDb().prepare("SELECT id, name, email FROM accounts WHERE id = ? AND role = 'supplier'").get(id) as
    | { id: string; name: string; email: string }
    | undefined;
}

export function supplierReturnKey(input: { supplierAccountId?: string | null; supplierName?: string | null }) {
  if (input.supplierAccountId) return `id:${input.supplierAccountId}`;
  if (input.supplierName?.trim()) return nameKey(input.supplierName);
  return null;
}

export function resolveReturnAddress(listing: {
  supplierAccountId?: string | null;
  supplierName?: string | null;
  returnLine1?: string | null;
  returnCity?: string | null;
  returnRegion?: string | null;
  returnPostal?: string | null;
  returnCountry?: string | null;
}): ReturnAddress | null {
  const override = returnAddressFromParts(
    listing.returnLine1,
    listing.returnCity,
    listing.returnRegion,
    listing.returnPostal,
    listing.returnCountry,
  );
  if (override) return override;
  if (listing.supplierAccountId) {
    const byAccount = readRow(`id:${listing.supplierAccountId}`);
    if (byAccount) return byAccount;
  }
  if (listing.supplierName?.trim()) return readRow(nameKey(listing.supplierName));
  return null;
}

export function returnCopyForListing(listing: Parameters<typeof resolveReturnAddress>[0]) {
  return resolveReturnAddress(listing) ? RETURNS_ON_ORDER : RETURNS_UNSET;
}

export function anyReturnAddress() {
  const named = getDb().prepare("SELECT 1 AS ok FROM supplier_returns LIMIT 1").get() as { ok: number } | undefined;
  if (named) return true;
  const override = getDb()
    .prepare("SELECT 1 AS ok FROM listings WHERE return_line1 IS NOT NULL AND trim(return_line1) != '' LIMIT 1")
    .get() as { ok: number } | undefined;
  return Boolean(override);
}

export function storeReturnCopy() {
  return anyReturnAddress() ? RETURNS_ON_ORDER : RETURNS_UNSET;
}

export function formatOrderReturn(order: {
  returnLine1?: string | null;
  returnCity?: string | null;
  returnRegion?: string | null;
  returnPostal?: string | null;
  returnCountry?: string | null;
}) {
  const address = returnAddressFromParts(
    order.returnLine1,
    order.returnCity,
    order.returnRegion,
    order.returnPostal,
    order.returnCountry,
  );
  return address ? formatReturnAddress(address) : null;
}

function blankChoice(key: string, label: string): SupplierReturnChoice {
  const saved = readRow(key);
  return {
    key,
    label,
    line1: saved?.line1 ?? "",
    city: saved?.city ?? "",
    region: saved?.region ?? "",
    postal: saved?.postal ?? "",
    country: saved?.country ?? "",
  };
}

export function listSupplierReturns(): SupplierReturnChoice[] {
  const accounts = getDb()
    .prepare("SELECT id, name, email FROM accounts WHERE role = 'supplier' ORDER BY name COLLATE NOCASE, email")
    .all() as { id: string; name: string; email: string }[];
  const names = getDb()
    .prepare("SELECT DISTINCT supplier_name AS name FROM listings WHERE trim(supplier_name) != '' ORDER BY supplier_name COLLATE NOCASE")
    .all() as { name: string }[];
  const choices = accounts.map((account) => blankChoice(`id:${account.id}`, `${account.name} · ${account.email}`));
  const seen = new Set(choices.map((choice) => choice.key));
  for (const row of names) {
    const key = nameKey(row.name);
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push(blankChoice(key, row.name));
  }
  return choices;
}

function knownKey(key: string) {
  if (key.startsWith("id:")) {
    const account = supplierAccount(key.slice(3));
    if (!account) return { error: "That supplier is not on the store." as const };
    return { key };
  }
  if (!key.startsWith("name:")) return { error: "Choose a supplier." as const };
  const name = key.slice(5).trim();
  if (name.length < 1 || name.length > 120) return { error: "Choose a supplier." as const };
  return { key: nameKey(name) };
}

export function saveSupplierReturn(
  account: Actor | null,
  supplierKey: string,
  input: { line1?: string | null; city?: string | null; region?: string | null; postal?: string | null; country?: string | null },
) {
  const denied = verifiedAdmin(account);
  if (denied) return denied;
  const key = knownKey(supplierKey);
  if ("error" in key) return { status: 400 as const, error: key.error };
  const parsed = parseReturnAddress(input);
  if ("error" in parsed) return { status: 400 as const, error: parsed.error };
  const db = getDb();
  if ("empty" in parsed) {
    db.prepare("DELETE FROM supplier_returns WHERE supplier_key = ?").run(key.key);
    return { status: 200 as const, address: null };
  }
  db.prepare(
    `INSERT INTO supplier_returns (supplier_key, line1, city, region, postal, country, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(supplier_key) DO UPDATE SET
       line1 = excluded.line1,
       city = excluded.city,
       region = excluded.region,
       postal = excluded.postal,
       country = excluded.country,
       updated_at = excluded.updated_at`,
  ).run(
    key.key,
    parsed.address.line1,
    parsed.address.city,
    parsed.address.region,
    parsed.address.postal,
    parsed.address.country,
    Date.now(),
  );
  return { status: 200 as const, address: parsed.address };
}

export function saveProductReturn(
  account: Actor | null,
  productId: string,
  input: { line1?: string | null; city?: string | null; region?: string | null; postal?: string | null; country?: string | null },
) {
  const denied = verifiedAdmin(account);
  if (denied) return denied;
  const listing = getDb().prepare("SELECT product_id FROM listings WHERE product_id = ?").get(productId) as
    | { product_id: string }
    | undefined;
  if (!listing) return { status: 404 as const, error: "That page is not on the store." as const };
  const parsed = parseReturnAddress(input);
  if ("error" in parsed) return { status: 400 as const, error: parsed.error };
  const address = "empty" in parsed ? null : parsed.address;
  getDb()
    .prepare(
      `UPDATE listings
       SET return_line1 = ?, return_city = ?, return_region = ?, return_postal = ?, return_country = ?
       WHERE product_id = ?`,
    )
    .run(
      address?.line1 ?? null,
      address?.city ?? null,
      address?.region ?? null,
      address?.postal ?? null,
      address?.country ?? null,
      productId,
    );
  return { status: 200 as const, address };
}
