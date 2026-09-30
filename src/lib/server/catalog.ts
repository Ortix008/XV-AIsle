import { randomUUID } from "node:crypto";
import { adminWithTotp } from "./access";
import type { PublicAccount } from "./accounts";
import { getAccount } from "./accounts";
import { getDb } from "./db";

export type CatalogItem = {
  id: string;
  accountId: string;
  sku: string;
  title: string;
  costCents: number;
  shippingCents: number;
  origin: string;
  approved: boolean;
  supplierName: string;
};

type CatalogRow = {
  id: string;
  account_id: string;
  sku: string;
  title: string;
  cost_cents: number;
  shipping_cents: number;
  origin: string;
  approved: number;
  supplier_name?: string;
};

function fromRow(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    accountId: row.account_id,
    sku: row.sku,
    title: row.title,
    costCents: row.cost_cents,
    shippingCents: row.shipping_cents,
    origin: row.origin,
    approved: row.approved === 1,
    supplierName: row.supplier_name ?? "",
  };
}

export function listApprovedCatalog() {
  const rows = getDb()
    .prepare(
      `SELECT catalog.id, catalog.account_id, catalog.sku, catalog.title, catalog.cost_cents,
              catalog.shipping_cents, catalog.origin, catalog.approved, accounts.name AS supplier_name
       FROM supplier_catalog catalog
       JOIN accounts ON accounts.id = catalog.account_id
       WHERE catalog.approved = 1 AND accounts.role = 'supplier'
       ORDER BY catalog.title`,
    )
    .all() as CatalogRow[];
  return rows.map(fromRow);
}

export function getApprovedCatalog(id: string) {
  const row = getDb()
    .prepare(
      `SELECT catalog.id, catalog.account_id, catalog.sku, catalog.title, catalog.cost_cents,
              catalog.shipping_cents, catalog.origin, catalog.approved, accounts.name AS supplier_name
       FROM supplier_catalog catalog
       JOIN accounts ON accounts.id = catalog.account_id
       WHERE catalog.id = ? AND catalog.approved = 1`,
    )
    .get(id) as CatalogRow | undefined;
  return row ? fromRow(row) : null;
}

export function createCatalogItem(
  account: PublicAccount,
  input: { sku: string; title: string; costCents: number; shippingCents: number; origin: string },
) {
  if (account.role !== "supplier") return { error: "Only a supplier can add a catalog price." as const };
  const sku = input.sku.trim();
  const title = input.title.trim();
  const origin = input.origin.trim();
  if (!sku || sku.length > 40 || !title || title.length > 180) return { error: "Add a short title and sku." as const };
  if (!origin || origin.length > 120) return { error: "Add where it ships from." as const };
  if (!Number.isInteger(input.costCents) || input.costCents < 0 || !Number.isInteger(input.shippingCents) || input.shippingCents < 0) {
    return { error: "Cost and shipping have to be whole cents." as const };
  }
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO supplier_catalog (
         id, account_id, sku, title, cost_cents, shipping_cents, origin, approved, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(id, account.id, sku, title, input.costCents, input.shippingCents, origin, Date.now());
  const item = getCatalogItem(id);
  if (!item) return { error: "The catalog item was not saved." as const };
  return { item };
}

export function getCatalogItem(id: string) {
  const row = getDb()
    .prepare(
      `SELECT catalog.id, catalog.account_id, catalog.sku, catalog.title, catalog.cost_cents,
              catalog.shipping_cents, catalog.origin, catalog.approved, accounts.name AS supplier_name
       FROM supplier_catalog catalog
       JOIN accounts ON accounts.id = catalog.account_id
       WHERE catalog.id = ?`,
    )
    .get(id) as CatalogRow | undefined;
  return row ? fromRow(row) : null;
}

export function reviewCatalogItem(account: PublicAccount, id: string, approved: boolean) {
  const decision = adminWithTotp(account);
  if (decision) return decision;
  const item = getCatalogItem(id);
  if (!item) return { status: 404 as const, error: "That product is not in the review queue." };
  getDb().prepare("UPDATE supplier_catalog SET approved = ? WHERE id = ?").run(approved ? 1 : 0, id);
  return { status: 200 as const, item: getCatalogItem(id) };
}

export function setCatalogApproval(account: PublicAccount, id: string, approved: boolean) {
  if (account.role !== "supplier") return { error: "Only a supplier can change a catalog price." as const };
  const owner = getAccount(account.id);
  if (!owner) return { error: "That account is not on file." as const };
  getDb()
    .prepare("UPDATE supplier_catalog SET approved = ? WHERE id = ? AND account_id = ?")
    .run(approved ? 1 : 0, id, account.id);
  return { ok: true as const };
}
