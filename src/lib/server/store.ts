import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { markMember } from "./accounts";
import { MEMBER_PRICE } from "../account";
import { requestShipment } from "./supplier";
import type { StripeSession } from "./stripe";

export type StoreListing = {
  productId: string;
  accountId: string;
  sku: string;
  title: string;
  description: string;
  priceCents: number;
  image: string;
  supplierName: string;
  supplierOrigin: string;
  shipDaysMin: number;
  shipDaysMax: number;
  published: boolean;
  madeInUsa: boolean;
  shelf: "national" | "small";
};

export type StoreOrder = {
  id: string;
  number: string;
  productId: string;
  accountId: string;
  customerName: string;
  email: string;
  qty: number;
  amountCents: number;
  shipLine1: string;
  shipCity: string;
  shipRegion: string;
  shipPostal: string;
  shipCountry: string;
  stripeSessionId: string | null;
  status: string;
  supplierRef: string | null;
  supplierDetail: string | null;
  createdAt: number;
  title?: string;
  sku?: string;
};

type ListingRow = {
  product_id: string;
  account_id: string;
  sku: string;
  title: string;
  description: string;
  price_cents: number;
  image: string;
  supplier_name: string;
  supplier_origin: string;
  ship_days_min: number;
  ship_days_max: number;
  published: number;
  made_in_usa?: number;
  shelf?: string;
};

type OrderRow = {
  id: string;
  number: string;
  product_id: string;
  account_id: string;
  customer_name: string;
  email: string;
  qty: number;
  amount_cents: number;
  ship_line1: string;
  ship_city: string;
  ship_region: string;
  ship_postal: string;
  ship_country: string;
  stripe_session_id: string | null;
  status: string;
  supplier_ref: string | null;
  supplier_detail: string | null;
  created_at: number;
};

function listingFrom(row: ListingRow): StoreListing {
  return {
    productId: row.product_id,
    accountId: row.account_id,
    sku: row.sku,
    title: row.title,
    description: row.description,
    priceCents: row.price_cents,
    image: row.image,
    supplierName: row.supplier_name,
    supplierOrigin: row.supplier_origin,
    shipDaysMin: row.ship_days_min,
    shipDaysMax: row.ship_days_max,
    published: row.published === 1,
    madeInUsa: row.made_in_usa === 1,
    shelf: row.shelf === "small" ? "small" : "national",
  };
}

function orderFrom(row: OrderRow, listing?: ListingRow): StoreOrder {
  return {
    id: row.id,
    number: row.number,
    productId: row.product_id,
    accountId: row.account_id,
    customerName: row.customer_name,
    email: row.email,
    qty: row.qty,
    amountCents: row.amount_cents,
    shipLine1: row.ship_line1,
    shipCity: row.ship_city,
    shipRegion: row.ship_region,
    shipPostal: row.ship_postal,
    shipCountry: row.ship_country,
    stripeSessionId: row.stripe_session_id,
    status: row.status,
    supplierRef: row.supplier_ref,
    supplierDetail: row.supplier_detail,
    createdAt: row.created_at,
    title: listing?.title,
    sku: listing?.sku,
  };
}

export function publishListing(
  accountId: string,
  input: Omit<StoreListing, "accountId" | "published" | "madeInUsa" | "shelf"> & {
    published?: boolean;
    madeInUsa?: boolean;
    shelf?: "national" | "small";
  },
) {
  if (!input.title.trim() || !input.sku.trim()) return { error: "The page needs a title." as const };
  if (input.title.length > 180 || input.sku.length > 40 || input.description.length > 4000) {
    return { error: "Shorten the page before it goes on the store." as const };
  }
  if (input.supplierName.length > 120 || input.supplierOrigin.length > 120) {
    return { error: "Shorten the shipper name." as const };
  }
  if (input.image && (!input.image.startsWith("/art/") || input.image.includes(".."))) {
    return { error: "Use a picture from this market." as const };
  }
  if (!Number.isInteger(input.priceCents) || input.priceCents < 50) return { error: "Set a price before the store can sell it." as const };
  const existing = getListing(input.productId);
  if (existing && existing.accountId !== accountId) {
    return { error: "That page already belongs to another account." as const };
  }
  const shelf = input.shelf === "small" ? "small" : "national";
  getDb()
    .prepare(
      `INSERT INTO listings (
         product_id, account_id, sku, title, description, price_cents, image,
         supplier_name, supplier_origin, ship_days_min, ship_days_max, published,
         made_in_usa, shelf
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(product_id) DO UPDATE SET
         account_id = excluded.account_id,
         sku = excluded.sku,
         title = excluded.title,
         description = excluded.description,
         price_cents = excluded.price_cents,
         image = excluded.image,
         supplier_name = excluded.supplier_name,
         supplier_origin = excluded.supplier_origin,
         ship_days_min = excluded.ship_days_min,
         ship_days_max = excluded.ship_days_max,
         published = excluded.published,
         made_in_usa = excluded.made_in_usa,
         shelf = excluded.shelf`,
    )
    .run(
      input.productId,
      accountId,
      input.sku,
      input.title.trim(),
      input.description.trim(),
      input.priceCents,
      input.image,
      input.supplierName,
      input.supplierOrigin,
      input.shipDaysMin,
      input.shipDaysMax,
      input.published === false ? 0 : 1,
      input.madeInUsa ? 1 : 0,
      shelf,
    );
  return { listing: getListing(input.productId) };
}

export function getListing(productId: string) {
  const row = getDb().prepare("SELECT * FROM listings WHERE product_id = ?").get(productId) as ListingRow | undefined;
  return row ? listingFrom(row) : null;
}

export function listPublished(filter?: { madeInUsa?: boolean; shelf?: "national" | "small" }) {
  const clauses = ["published = 1"];
  const params: Array<string | number> = [];
  if (filter?.madeInUsa) clauses.push("made_in_usa = 1");
  if (filter?.shelf) {
    clauses.push("shelf = ?");
    params.push(filter.shelf);
  }
  const rows = getDb()
    .prepare(`SELECT * FROM listings WHERE ${clauses.join(" AND ")} ORDER BY title`)
    .all(...params) as ListingRow[];
  return rows.map(listingFrom);
}

export type ShipTo = {
  name: string;
  email: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

export function createPendingOrder(input: { productId: string; qty: number; ship: ShipTo }) {
  const listing = getDb().prepare("SELECT * FROM listings WHERE product_id = ? AND published = 1").get(input.productId) as
    | ListingRow
    | undefined;
  if (!listing) return { error: "That page is not on the store." as const };
  const qty = input.qty;
  if (!Number.isInteger(qty) || qty < 1 || qty > 5) return { error: "Order between 1 and 5." as const };
  const ship = input.ship;
  if (ship.name.trim().length < 2 || ship.name.length > 80) return { error: "Add the name for the box." as const };
  if (ship.email.length > 120 || !ship.email.includes("@")) return { error: "Add an email for the receipt." as const };
  if (
    ship.line1.trim().length < 4 ||
    ship.line1.length > 120 ||
    ship.city.trim().length < 2 ||
    ship.city.length > 80 ||
    ship.region.trim().length < 2 ||
    ship.region.length > 40
  ) {
    return { error: "Add the street, city, and state." as const };
  }
  if (ship.postal.trim().length < 4 || ship.postal.length > 12) return { error: "Add the postal code." as const };
  if ((ship.country.trim() || "US").toUpperCase() !== "US") return { error: "This store ships in the US." as const };
  const count = getDb().prepare("SELECT COUNT(*) AS n FROM orders").get() as { n: number };
  const id = randomUUID();
  const number = `XV-${1001 + count.n}`;
  const amount = listing.price_cents * qty;
  const created = Date.now();
  getDb()
    .prepare(
      `INSERT INTO orders (
         id, number, product_id, account_id, customer_name, email, qty, amount_cents,
         ship_line1, ship_city, ship_region, ship_postal, ship_country,
         stripe_session_id, status, supplier_ref, supplier_detail, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL, ?)`,
    )
    .run(
      id,
      number,
      listing.product_id,
      listing.account_id,
      ship.name.trim(),
      ship.email.trim().toLowerCase(),
      qty,
      amount,
      ship.line1.trim(),
      ship.city.trim(),
      ship.region.trim(),
      ship.postal.trim(),
      (ship.country.trim() || "US").toUpperCase(),
      created,
    );
  return { order: getOrder(id)!, listing: listingFrom(listing) };
}

export function attachStripeSession(orderId: string, sessionId: string) {
  getDb().prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").run(sessionId, orderId);
}

export function getOrder(id: string) {
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
  if (!row) return null;
  const listing = getDb().prepare("SELECT * FROM listings WHERE product_id = ?").get(row.product_id) as ListingRow | undefined;
  return orderFrom(row, listing);
}

export function ordersForAccount(accountId: string) {
  const rows = getDb()
    .prepare("SELECT * FROM orders WHERE account_id = ? ORDER BY created_at DESC")
    .all(accountId) as OrderRow[];
  return rows.map((row) => {
    const listing = getDb().prepare("SELECT * FROM listings WHERE product_id = ?").get(row.product_id) as
      | ListingRow
      | undefined;
    return orderFrom(row, listing);
  });
}

export async function fulfillPaidOrder(orderId: string) {
  const row = getDb().prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) return null;
  if (row.status === "queued" || row.status === "accepted" || row.status === "supplier_error") {
    return getOrder(orderId);
  }
  const listing = getDb().prepare("SELECT * FROM listings WHERE product_id = ?").get(row.product_id) as ListingRow | undefined;
  const result = await requestShipment({
    orderId: row.id,
    number: row.number,
    sku: listing?.sku ?? row.product_id,
    title: listing?.title ?? "Listing",
    qty: row.qty,
    supplierName: listing?.supplier_name ?? "Supplier",
    shipTo: {
      name: row.customer_name,
      email: row.email,
      line1: row.ship_line1,
      city: row.ship_city,
      region: row.ship_region,
      postal: row.ship_postal,
      country: row.ship_country,
    },
  });
  getDb()
    .prepare("UPDATE orders SET status = ?, supplier_ref = ?, supplier_detail = ? WHERE id = ?")
    .run(result.status, result.ref, result.detail, orderId);
  return getOrder(orderId);
}

export async function settleCheckoutSession(session: StripeSession) {
  const paid = session.payment_status === "paid" || session.status === "complete";
  if (!paid) return { error: "Payment is not complete." as const };
  const kind = session.metadata?.kind;
  if (kind === "membership") {
    const accountId = session.metadata.account_id;
    if (!accountId) return { error: "Checkout is missing the account." as const };
    if (session.amount_total !== MEMBER_PRICE * 100) {
      return { error: "The paid amount does not match membership." as const };
    }
    markMember(accountId, session.customer, session.subscription);
    return { kind: "membership" as const };
  }
  if (kind === "order") {
    const orderId = session.metadata.order_id;
    if (!orderId) return { error: "Checkout is missing the order." as const };
    const current = getOrder(orderId);
    if (!current) return { error: "That order is not on file." as const };
    if (session.amount_total !== current.amountCents) {
      return { error: "The paid amount does not match this order." as const };
    }
    if (session.id) {
      getDb().prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ? AND stripe_session_id IS NULL").run(session.id, orderId);
    }
    const order = await fulfillPaidOrder(orderId);
    return { kind: "order" as const, order };
  }
  return { error: "Checkout did not say what it was paying for." as const };
}
