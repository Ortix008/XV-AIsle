import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getApprovedCatalog } from "./catalog";
import { FULFILL_TIMEOUT_MS, US_TRANSFER_HOLD_MS, holdState, platformFeeBps, quoteSplit, saleBlock } from "./fees";
import { changed, getDb } from "./db";
import { requestShipment } from "./supplier";

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
  supplierAccountId: string | null;
  supplierCostCents: number;
  supplierShippingCents: number;
  feeBps: number | null;
  catalogItemId: string | null;
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
  paymentIntentId: string | null;
  chargeId: string | null;
  transferGroup: string | null;
  feeBps: number | null;
  platformFeeCents: number | null;
  stripeFeeEstCents: number | null;
  stripeFeeCents: number | null;
  supplierAmountCents: number | null;
  resellerAmountCents: number | null;
  supplierAccountId: string | null;
  deliveredAt: number | null;
  paidAt: number | null;
  riskLevel: string | null;
  riskType: string | null;
  riskApproved: boolean;
  reviewOpen: boolean;
  reviewClosed: boolean;
  disputeOpen: boolean;
  carrier: string | null;
  trackingNumber: string | null;
  shippedAt: number | null;
  buyerConfirmedAt: number | null;
  buyerDisputeOpen: boolean;
  buyerDisputeResolved: boolean;
  buyerDisputeNote: string | null;
  refundRequired: boolean;
  fulfillmentFlag: string | null;
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
  supplier_account_id?: string | null;
  supplier_cost_cents?: number | null;
  supplier_shipping_cents?: number | null;
  fee_bps?: number | null;
  catalog_item_id?: string | null;
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
  payment_intent_id?: string | null;
  charge_id?: string | null;
  transfer_group?: string | null;
  fee_bps?: number | null;
  platform_fee_cents?: number | null;
  stripe_fee_est_cents?: number | null;
  stripe_fee_cents?: number | null;
  supplier_amount_cents?: number | null;
  reseller_amount_cents?: number | null;
  supplier_account_id?: string | null;
  delivered_at?: number | null;
  paid_at?: number | null;
  risk_level?: string | null;
  risk_type?: string | null;
  risk_approved?: number | null;
  review_open?: number | null;
  review_closed?: number | null;
  dispute_open?: number | null;
  carrier?: string | null;
  tracking_number?: string | null;
  shipped_at?: number | null;
  buyer_confirmed_at?: number | null;
  buyer_dispute_open?: number | null;
  buyer_dispute_resolved?: number | null;
  buyer_dispute_note?: string | null;
  refund_required?: number | null;
  fulfillment_flag?: string | null;
  fulfilling_started_at?: number | null;
  fulfillment_attempts?: number | null;
  receipt_token_hash?: string | null;
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
    supplierAccountId: row.supplier_account_id ?? null,
    supplierCostCents: row.supplier_cost_cents ?? 0,
    supplierShippingCents: row.supplier_shipping_cents ?? 0,
    feeBps: row.fee_bps ?? null,
    catalogItemId: row.catalog_item_id ?? null,
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
    paymentIntentId: row.payment_intent_id ?? null,
    chargeId: row.charge_id ?? null,
    transferGroup: row.transfer_group ?? null,
    feeBps: row.fee_bps ?? null,
    platformFeeCents: row.platform_fee_cents ?? null,
    stripeFeeEstCents: row.stripe_fee_est_cents ?? null,
    stripeFeeCents: row.stripe_fee_cents ?? null,
    supplierAmountCents: row.supplier_amount_cents ?? null,
    resellerAmountCents: row.reseller_amount_cents ?? null,
    supplierAccountId: row.supplier_account_id ?? null,
    deliveredAt: row.delivered_at ?? null,
    paidAt: row.paid_at ?? null,
    riskLevel: row.risk_level ?? null,
    riskType: row.risk_type ?? null,
    riskApproved: row.risk_approved === 1,
    reviewOpen: row.review_open === 1,
    reviewClosed: row.review_closed === 1,
    disputeOpen: row.dispute_open === 1,
    carrier: row.carrier ?? null,
    trackingNumber: row.tracking_number ?? null,
    shippedAt: row.shipped_at ?? null,
    buyerConfirmedAt: row.buyer_confirmed_at ?? null,
    buyerDisputeOpen: row.buyer_dispute_open === 1,
    buyerDisputeResolved: row.buyer_dispute_resolved === 1,
    buyerDisputeNote: row.buyer_dispute_note ?? null,
    refundRequired: row.refund_required === 1,
    fulfillmentFlag: row.fulfillment_flag ?? null,
  };
}

function receiptHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function allocateOrderNumber() {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const seedRow = db
      .prepare(
        `SELECT COALESCE(MAX(CAST(SUBSTR(number, 4) AS INTEGER)), 1000) + 1 AS next_number
         FROM orders
         WHERE number GLOB 'XV-[0-9]*'`,
      )
      .get() as { next_number: number | bigint };
    const seed = Number(seedRow?.next_number);
    const start = Number.isInteger(seed) && seed >= 1001 ? seed : 1001;
    db.prepare("INSERT INTO order_seq (id, next_number) VALUES (1, ?) ON CONFLICT(id) DO NOTHING").run(start);
    db.prepare("UPDATE order_seq SET next_number = ? WHERE id = 1 AND next_number < ?").run(start, start);
    const row = db.prepare("SELECT next_number FROM order_seq WHERE id = 1").get() as { next_number: number | bigint };
    const next = Number(row.next_number);
    db.prepare("UPDATE order_seq SET next_number = ? WHERE id = 1").run(next + 1);
    db.exec("COMMIT");
    return next;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function publishListing(
  accountId: string,
  input: Omit<
    StoreListing,
    | "accountId"
    | "published"
    | "madeInUsa"
    | "shelf"
    | "supplierAccountId"
    | "supplierCostCents"
    | "supplierShippingCents"
    | "feeBps"
    | "catalogItemId"
  > & {
    published?: boolean;
    madeInUsa?: boolean;
    shelf?: "national" | "small";
    supplierAccountId?: string | null;
    supplierCostCents?: number;
    supplierShippingCents?: number;
    feeBps?: number | null;
    catalogItemId?: string | null;
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
         made_in_usa, shelf, supplier_account_id, supplier_cost_cents, supplier_shipping_cents, fee_bps,
         catalog_item_id
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         shelf = excluded.shelf,
         supplier_account_id = excluded.supplier_account_id,
         supplier_cost_cents = excluded.supplier_cost_cents,
         supplier_shipping_cents = excluded.supplier_shipping_cents,
         fee_bps = excluded.fee_bps,
         catalog_item_id = excluded.catalog_item_id`,
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
      input.supplierAccountId?.trim() || null,
      input.supplierCostCents ?? 0,
      input.supplierShippingCents ?? 0,
      input.feeBps ?? null,
      input.catalogItemId ?? null,
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
  return rows.map(listingFrom).filter((listing) => !listingLoss(listing));
}

function pauseListing(productId: string) {
  getDb().prepare("UPDATE listings SET published = 0 WHERE product_id = ?").run(productId);
}

/** Current supplier cost from the approved catalog when the listing is tied to one. */
function pricedSplit(listing: StoreListing, qty: number) {
  let supplierCostCents = listing.supplierCostCents;
  let supplierShippingCents = listing.supplierShippingCents;
  if (listing.catalogItemId) {
    const item = getApprovedCatalog(listing.catalogItemId);
    if (!item) return { error: "That supplier item is no longer approved." as const };
    supplierCostCents = item.costCents;
    supplierShippingCents = item.shippingCents;
  }
  const split = quoteSplit({
    priceCents: listing.priceCents,
    qty,
    supplierCostCents,
    supplierShippingCents,
    feeBps: platformFeeBps(),
  });
  return { split };
}

export function listingLoss(listing: StoreListing) {
  if (!listing.supplierAccountId && !listing.catalogItemId) return null;
  const priced = pricedSplit(listing, 1);
  if ("error" in priced) return priced.error;
  return saleBlock({
    priceCents: listing.priceCents,
    split: priced.split,
    supplierAccountId: listing.supplierAccountId,
  });
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
  const id = randomUUID();
  const number = `XV-${allocateOrderNumber()}`;
  const receiptToken = randomBytes(32).toString("hex");
  const page = listingFrom(listing);
  const priced = pricedSplit(page, qty);
  if ("error" in priced) {
    pauseListing(page.productId);
    return { error: priced.error };
  }
  const problem = saleBlock({
    priceCents: page.priceCents,
    split: priced.split,
    supplierAccountId: page.supplierAccountId,
  });
  if (problem) {
    if (page.supplierAccountId) pauseListing(page.productId);
    return { error: problem };
  }
  const split = priced.split;
  const created = Date.now();
  getDb()
    .prepare(
      `INSERT INTO orders (
         id, number, product_id, account_id, customer_name, email, qty, amount_cents,
         ship_line1, ship_city, ship_region, ship_postal, ship_country,
         stripe_session_id, status, supplier_ref, supplier_detail, created_at,
         transfer_group, fee_bps, platform_fee_cents, supplier_amount_cents, reseller_amount_cents, supplier_account_id,
         receipt_token_hash, stripe_fee_est_cents, stripe_fee_cents
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      number,
      listing.product_id,
      listing.account_id,
      ship.name.trim(),
      ship.email.trim().toLowerCase(),
      qty,
      split.grossCents,
      ship.line1.trim(),
      ship.city.trim(),
      ship.region.trim(),
      ship.postal.trim(),
      (ship.country.trim() || "US").toUpperCase(),
      created,
      `order_${id}`,
      split.feeBps,
      split.platformFeeCents,
      split.supplierAmountCents,
      split.resellerAmountCents,
      page.supplierAccountId,
      receiptHash(receiptToken),
      split.stripeFeeCents,
      split.stripeFeeCents,
    );
  return { order: getOrder(id)!, listing: listingFrom(listing), receiptToken };
}

export function attachStripeSession(orderId: string, sessionId: string) {
  getDb().prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").run(sessionId, orderId);
}

export function orderByReceiptToken(token: string) {
  if (!token || token.length < 32) return null;
  const row = getDb().prepare("SELECT id FROM orders WHERE receipt_token_hash = ?").get(receiptHash(token)) as
    | { id: string }
    | undefined;
  return row ? getOrder(row.id) : null;
}

export function markShipped(orderId: string, carrier: string, tracking: string) {
  const carrierName = carrier.trim();
  const trackingNumber = tracking.trim();
  if (carrierName.length < 2 || carrierName.length > 40) return { error: "Name the carrier." as const };
  if (!/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber)) {
    return { error: "Add a tracking number made of letters, numbers, and dashes." as const };
  }
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.status === "pending") return { error: "This order is not paid." as const };
  getDb()
    .prepare(
      "UPDATE orders SET carrier = ?, tracking_number = ?, shipped_at = COALESCE(shipped_at, ?) WHERE id = ?",
    )
    .run(carrierName, trackingNumber, Date.now(), orderId);
  return { order: getOrder(orderId)! };
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
  const db = getDb();
  const claim = changed(
    db.prepare(
      "UPDATE orders SET status = 'fulfilling', fulfilling_started_at = ? WHERE id = ? AND status = 'paid'",
    ).run(Date.now(), orderId),
  );
  if (claim !== 1) return getOrder(orderId);
  const row = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow | undefined;
  if (!row) return null;
  const listing = db.prepare("SELECT * FROM listings WHERE product_id = ?").get(row.product_id) as ListingRow | undefined;
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
  changed(
    db
      .prepare("UPDATE orders SET status = ?, supplier_ref = ?, supplier_detail = ? WHERE id = ? AND status = 'fulfilling'")
      .run(result.status, result.ref, result.detail, orderId),
  );
  return getOrder(orderId);
}

export async function sweepStuckFulfillment(now = Date.now()) {
  const cutoff = now - FULFILL_TIMEOUT_MS;
  const rows = getDb()
    .prepare(
      `SELECT id, supplier_ref, fulfillment_attempts
       FROM orders
       WHERE status = 'fulfilling' AND fulfilling_started_at IS NOT NULL AND fulfilling_started_at <= ?`,
    )
    .all(cutoff) as { id: string; supplier_ref: string | null; fulfillment_attempts: number | null }[];
  for (const row of rows) {
    const attempts = row.fulfillment_attempts ?? 0;
    if (!row.supplier_ref && attempts < 1) {
      const reset = changed(
        getDb()
          .prepare(
            `UPDATE orders
             SET status = 'paid', fulfillment_attempts = fulfillment_attempts + 1, fulfillment_flag = 'retried'
             WHERE id = ? AND status = 'fulfilling'`,
          )
          .run(row.id),
      );
      if (reset === 1) await fulfillPaidOrder(row.id);
      continue;
    }
    getDb()
      .prepare("UPDATE orders SET fulfillment_flag = 'stuck' WHERE id = ? AND status = 'fulfilling'")
      .run(row.id);
  }
}

export function flagRefundDeadlines(now = Date.now()) {
  // TODO: other platform countries use a shorter hold than US_TRANSFER_HOLD_MS.
  const deadline = now - US_TRANSFER_HOLD_MS;
  getDb()
    .prepare(
      "UPDATE orders SET refund_required = 1 WHERE paid_at IS NOT NULL AND paid_at <= ? AND refund_required = 0",
    )
    .run(deadline);
}

export function listHoldAlerts(now = Date.now()) {
  flagRefundDeadlines(now);
  const rows = getDb()
    .prepare("SELECT id, number, paid_at, refund_required FROM orders WHERE paid_at IS NOT NULL")
    .all() as { id: string; number: string; paid_at: number; refund_required: number }[];
  const alerts: { id: string; number: string; kind: "refund" | "nearing" }[] = [];
  for (const row of rows) {
    if (row.refund_required === 1) {
      alerts.push({ id: row.id, number: row.number, kind: "refund" });
      continue;
    }
    if (holdState(row.paid_at, now) === "nearing") alerts.push({ id: row.id, number: row.number, kind: "nearing" });
  }
  return alerts;
}

export function ordersVisibleTo(account: { id: string; role: string }) {
  const db = getDb();
  const rows =
    account.role === "admin"
      ? (db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as OrderRow[])
      : (db
          .prepare(
            "SELECT * FROM orders WHERE account_id = ? OR supplier_account_id = ? ORDER BY created_at DESC",
          )
          .all(account.id, account.id) as OrderRow[]);
  return rows.map((row) => {
    const listing = db.prepare("SELECT * FROM listings WHERE product_id = ?").get(row.product_id) as ListingRow | undefined;
    return orderFrom(row, listing);
  });
}
