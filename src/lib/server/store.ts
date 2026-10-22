import { createHash, randomBytes, randomUUID } from "node:crypto";
import { aisleBySlug, aisleByTitle, placeProduct } from "../aisles";
import { bundlePriceRejection } from "../bundles";
import { getProduct } from "../catalog";
import { compareAtRejection } from "../honest-price";
import { isQaCheckoutListing, qaCheckoutSeedAllowed } from "../qa-checkout";
import { isHeldSample, isScentedCandleListing, isWoodTrayListing } from "../shelf-holds";
import { cleanSupplierEmail, cleanSupplierOrderUrl, isBlockedTestOrder, parseListingRoute, type ListingRoute } from "../order-flags";
import { getApprovedCatalog } from "./catalog";
import { FULFILL_TIMEOUT_MS, US_TRANSFER_HOLD_MS, holdState, platformFeeBps, quoteSplit, saleBlock } from "./fees";
import { marginGuard, snapshotOrderCost } from "./money-flow";
import { changed, getDb } from "./db";
import { etaFromListing } from "../order-facts";
import { sendBrandOrder, sendCustomerReceipt, sendOpsAlert, sendShippedMail } from "./order-mail";
import { formatOrderReturn, resolveReturnAddress } from "./supplier-returns";
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
  shipsFrom: string | null;
  deliveryTime: string | null;
  whyWePicked: string | null;
  brand: string | null;
  whyItCosts: string | null;
  checkedBy: string | null;
  checkedOn: string | null;
  checkedNote: string | null;
  route: ListingRoute;
  supplierOrderUrl: string | null;
  supplierEmail: string | null;
  kind: "single" | "bundle";
  aisle: string | null;
  hiddenFromShop: boolean;
  supplierUsConfirmed: boolean;
  returnLine1: string | null;
  returnCity: string | null;
  returnRegion: string | null;
  returnPostal: string | null;
  returnCountry: string | null;
  /** Private. Cents. Shoppers and resellers never receive this. */
  wholesaleCost: number | null;
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
  supplierPaidCents: number | null;
  placedAt: number | null;
  placeRemindedAt: number | null;
  trackingUpdatedAt: number | null;
  delayFlaggedAt: number | null;
  delayNoticeSentAt: number | null;
  delayExpectedOn: string | null;
  delayRefundRequestedAt: number | null;
  delayRefundDueAt: number | null;
  delayRefundedAt: number | null;
  refundedAt: number | null;
  returnLine1: string | null;
  returnCity: string | null;
  returnRegion: string | null;
  returnPostal: string | null;
  returnCountry: string | null;
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
  ships_from?: string | null;
  delivery_time?: string | null;
  why_we_picked?: string | null;
  brand?: string | null;
  why_it_costs?: string | null;
  checked_by?: string | null;
  checked_on?: string | null;
  checked_note?: string | null;
  route?: string | null;
  supplier_order_url?: string | null;
  supplier_email?: string | null;
  kind?: string | null;
  aisle?: string | null;
  return_line1?: string | null;
  return_city?: string | null;
  return_region?: string | null;
  return_postal?: string | null;
  return_country?: string | null;
  wholesale_cost?: number | null;
  hidden_from_shop?: number | null;
  supplier_us_confirmed?: number | null;
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
  supplier_paid_cents?: number | null;
  placed_at?: number | null;
  place_reminded_at?: number | null;
  tracking_updated_at?: number | null;
  delay_flagged_at?: number | null;
  delay_notice_sent_at?: number | null;
  delay_expected_on?: string | null;
  delay_refund_requested_at?: number | null;
  delay_refund_due_at?: number | null;
  delay_refunded_at?: number | null;
  refunded_at?: number | null;
  return_line1?: string | null;
  return_city?: string | null;
  return_region?: string | null;
  return_postal?: string | null;
  return_country?: string | null;
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
    shipsFrom: row.ships_from?.trim() || null,
    deliveryTime: row.delivery_time?.trim() || null,
    whyWePicked: row.why_we_picked?.trim() || null,
    brand: row.brand?.trim() || null,
    whyItCosts: row.why_it_costs?.trim() || null,
    checkedBy: row.checked_by?.trim() || null,
    checkedOn: row.checked_on?.trim() || null,
    checkedNote: row.checked_note?.trim() || null,
    route: parseListingRoute(row.route),
    supplierOrderUrl: row.supplier_order_url ?? null,
    supplierEmail: row.supplier_email ?? null,
    kind: row.kind === "bundle" ? "bundle" : "single",
    aisle: row.aisle?.trim() || null,
    returnLine1: row.return_line1?.trim() || null,
    returnCity: row.return_city?.trim() || null,
    returnRegion: row.return_region?.trim() || null,
    returnPostal: row.return_postal?.trim() || null,
    returnCountry: row.return_country?.trim() || null,
    wholesaleCost: row.wholesale_cost ?? null,
    hiddenFromShop: row.hidden_from_shop === 1,
    supplierUsConfirmed: row.supplier_us_confirmed === 1,
  };
}

export function bundlePieces(bundleId: string) {
  const rows = getDb()
    .prepare(
      `SELECT listings.product_id, listings.title
       FROM bundle_items
       JOIN listings ON listings.product_id = bundle_items.product_id
       WHERE bundle_items.bundle_id = ?
       ORDER BY bundle_items.position`,
    )
    .all(bundleId) as { product_id: string; title: string }[];
  return rows.map((row) => ({ productId: row.product_id, title: row.title }));
}

function routedTitle(order: { title?: string | null; productId: string }, listing: StoreListing | null) {
  const base = order.title ?? listing?.title ?? "Listing";
  if (!listing || listing.kind !== "bundle") return base;
  const pieces = bundlePieces(listing.productId);
  if (pieces.length === 0) return base;
  return `${base}. Includes ${pieces.map((piece) => piece.title).join(", ")}`;
}

/** Shopper-facing listing. Cost, margin, fees, and any fund share stay off this object. */
export function publicShopListing(listing: StoreListing, sample: boolean) {
  const whyWePicked = listing.whyWePicked?.trim() || "";
  return {
    productId: listing.productId,
    sku: listing.sku,
    title: sample && !listing.title.endsWith(" (Sample)") ? `${listing.title} (Sample)` : listing.title,
    description: listing.description,
    priceCents: listing.priceCents,
    image: listing.image,
    supplierName: isHeldSample(listing) ? "" : listing.supplierName,
    supplierOrigin: isHeldSample(listing) ? "" : listing.supplierOrigin,
    shipDaysMin: listing.shipDaysMin,
    shipDaysMax: listing.shipDaysMax,
    madeInUsa: listing.madeInUsa,
    shelf: listing.shelf,
    sample,
    supplierUsConfirmed: listing.supplierUsConfirmed,
    ...(listing.shipsFrom ? { shipsFrom: listing.shipsFrom } : {}),
    ...(listing.deliveryTime ? { deliveryTime: listing.deliveryTime } : {}),
    ...(whyWePicked ? { whyWePicked } : {}),
    ...(listing.brand ? { brand: listing.brand } : {}),
    ...(listing.whyItCosts ? { whyItCosts: listing.whyItCosts } : {}),
    ...(listing.checkedBy && listing.checkedOn && listing.checkedNote
      ? { checkedBy: listing.checkedBy, checkedOn: listing.checkedOn, checkedNote: listing.checkedNote }
      : {}),
    ...(listing.aisle ? { aisle: listing.aisle } : {}),
    ...(listing.kind === "bundle" ? { kind: "bundle" as const, includes: bundlePieces(listing.productId) } : {}),
  };
}

function optionalCopy(
  value: string | null | undefined,
  existing: string | null,
  max: number,
  label: string,
  collapse: boolean,
): { text: string | null } | { error: string } {
  if (value === undefined) return { text: existing };
  if (value === null) return { text: null };
  const text = collapse ? value.trim().replace(/\s+/g, " ") : value.replace(/\r\n/g, "\n").trim();
  if (!text) return { text: null };
  if (text.length > max) return { error: `Shorten the ${label}.` };
  return { text };
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
    supplierPaidCents: row.supplier_paid_cents ?? null,
    placedAt: row.placed_at ?? null,
    placeRemindedAt: row.place_reminded_at ?? null,
    trackingUpdatedAt: row.tracking_updated_at ?? null,
    delayFlaggedAt: row.delay_flagged_at ?? null,
    delayNoticeSentAt: row.delay_notice_sent_at ?? null,
    delayExpectedOn: row.delay_expected_on ?? null,
    delayRefundRequestedAt: row.delay_refund_requested_at ?? null,
    delayRefundDueAt: row.delay_refund_due_at ?? null,
    delayRefundedAt: row.delay_refunded_at ?? null,
    refundedAt: row.refunded_at ?? null,
    returnLine1: row.return_line1?.trim() || null,
    returnCity: row.return_city?.trim() || null,
    returnRegion: row.return_region?.trim() || null,
    returnPostal: row.return_postal?.trim() || null,
    returnCountry: row.return_country?.trim() || null,
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
    let next = Number(row.next_number);
    // XV-1001 is a test purchase and is never issued again.
    if (next <= 1001) next = 1002;
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
    | "shipsFrom"
    | "deliveryTime"
    | "whyWePicked"
    | "brand"
    | "whyItCosts"
    | "checkedBy"
    | "checkedOn"
    | "checkedNote"
    | "route"
    | "supplierOrderUrl"
    | "supplierEmail"
    | "kind"
    | "aisle"
    | "returnLine1"
    | "returnCity"
    | "returnRegion"
    | "returnPostal"
    | "returnCountry"
    | "wholesaleCost"
    | "hiddenFromShop"
    | "supplierUsConfirmed"
  > & {
    published?: boolean;
    madeInUsa?: boolean;
    shelf?: "national" | "small";
    supplierAccountId?: string | null;
    supplierCostCents?: number;
    supplierShippingCents?: number;
    feeBps?: number | null;
    catalogItemId?: string | null;
    shipsFrom?: string | null;
    deliveryTime?: string | null;
    whyWePicked?: string | null;
    brand?: string | null;
    whyItCosts?: string | null;
    route?: ListingRoute;
    supplierOrderUrl?: string | null;
    supplierEmail?: string | null;
    aisle?: string | null;
    hiddenFromShop?: boolean;
    supplierUsConfirmed?: boolean;
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
  if (existing?.wholesaleCost != null && input.published !== false) {
    const guarded = marginGuard(input.priceCents, existing.wholesaleCost);
    if (guarded) return { error: guarded satisfies string };
  }
  if (existing && existing.accountId !== accountId) {
    return { error: "That page already belongs to another account." as const };
  }
  const shelf = input.shelf === "small" ? "small" : "national";
  const shipsFrom = optionalCopy(input.shipsFrom, existing?.shipsFrom ?? null, 120, "ships-from line", true);
  if ("error" in shipsFrom) return shipsFrom;
  const deliveryTime = optionalCopy(input.deliveryTime, existing?.deliveryTime ?? null, 120, "delivery time", true);
  if ("error" in deliveryTime) return deliveryTime;
  const whyWePicked = optionalCopy(input.whyWePicked, existing?.whyWePicked ?? null, 800, "why-we-picked note", false);
  if ("error" in whyWePicked) return whyWePicked;
  const brand = optionalCopy(input.brand, existing?.brand ?? null, 80, "brand", true);
  if ("error" in brand) return brand;
  const whyItCosts = optionalCopy(input.whyItCosts, existing?.whyItCosts ?? null, 240, "cost line", false);
  if ("error" in whyItCosts) return whyItCosts;
  const struck = compareAtRejection({
    title: input.title,
    description: input.description,
    brand: brand.text,
    whyItCosts: whyItCosts.text,
    whyWePicked: whyWePicked.text,
    shipsFrom: shipsFrom.text,
    deliveryTime: deliveryTime.text,
  });
  if (struck) return { error: struck };
  const derivedAisle = aisleSlugForProduct(input.productId);
  const aisle = input.aisle !== undefined ? input.aisle?.trim() || null : (existing?.aisle ?? derivedAisle);
  if (aisle && !aisleBySlug(aisle)) return { error: "That aisle is not on the store." as const };
  const hiddenFromShop = input.hiddenFromShop ?? existing?.hiddenFromShop ?? false;
  const supplierUsConfirmed = input.supplierUsConfirmed ?? existing?.supplierUsConfirmed ?? false;
  getDb()
    .prepare(
      `INSERT INTO listings (
         product_id, account_id, sku, title, description, price_cents, image,
         supplier_name, supplier_origin, ship_days_min, ship_days_max, published,
         made_in_usa, shelf, supplier_account_id, supplier_cost_cents, supplier_shipping_cents, fee_bps,
         catalog_item_id, ships_from, delivery_time, why_we_picked, brand, why_it_costs,
         hidden_from_shop, supplier_us_confirmed
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
         catalog_item_id = excluded.catalog_item_id,
         ships_from = excluded.ships_from,
         delivery_time = excluded.delivery_time,
         why_we_picked = excluded.why_we_picked,
         brand = excluded.brand,
         why_it_costs = excluded.why_it_costs,
         hidden_from_shop = excluded.hidden_from_shop,
         supplier_us_confirmed = excluded.supplier_us_confirmed`,
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
      shipsFrom.text,
      deliveryTime.text,
      whyWePicked.text,
      brand.text,
      whyItCosts.text,
      hiddenFromShop ? 1 : 0,
      supplierUsConfirmed ? 1 : 0,
    );
  const route = input.route ? parseListingRoute(input.route) : null;
  const supplierOrderUrl = cleanSupplierOrderUrl(input.supplierOrderUrl);
  const supplierEmail = cleanSupplierEmail(input.supplierEmail);
  if (route || supplierOrderUrl || supplierEmail) {
    getDb()
      .prepare(
        `UPDATE listings
         SET route = COALESCE(?, route),
             supplier_order_url = COALESCE(?, supplier_order_url),
             supplier_email = COALESCE(?, supplier_email)
         WHERE product_id = ?`,
      )
      .run(route, supplierOrderUrl, supplierEmail, input.productId);
  }
  getDb().prepare("UPDATE listings SET aisle = ? WHERE product_id = ?").run(aisle, input.productId);
  return { listing: getListing(input.productId) };
}

function aisleSlugForProduct(productId: string) {
  try {
    const place = placeProduct(getProduct(productId));
    if (!place) return null;
    return aisleByTitle(place.aisle)?.slug ?? null;
  } catch {
    return null;
  }
}

function supplierKey(listing: StoreListing) {
  if (listing.supplierAccountId) return `account:${listing.supplierAccountId}`;
  return `name:${listing.supplierName.trim().toLowerCase()}`;
}

export function publishBundle(
  account: { id: string; role: string },
  input: {
    productId: string;
    sku: string;
    title: string;
    description: string;
    priceCents: number;
    image: string;
    itemIds: string[];
    aisle?: string | null;
  },
) {
  if (account.role !== "admin") return { error: "Only an operator can price a bundle." as const };
  const struck = bundlePriceRejection({ title: input.title, description: input.description });
  if (struck) return { error: struck };
  const itemIds = [...new Set(input.itemIds.map((id) => id.trim()).filter(Boolean))];
  if (itemIds.length < 2) return { error: "A bundle needs at least two listings." as const };
  if (itemIds.includes(input.productId)) return { error: "A bundle cannot include itself." as const };
  const items = itemIds.map((id) => getListing(id));
  if (items.some((item) => !item || !item.published || item.kind === "bundle")) {
    return { error: "Every piece has to be a published listing, and not another bundle." as const };
  }
  const pieces = items.filter((item): item is StoreListing => item !== null);
  const first = pieces[0];
  if (!first || pieces.length < 2) return { error: "A bundle needs at least two listings." as const };
  const key = supplierKey(first);
  if (pieces.some((item) => supplierKey(item) !== key)) {
    return { error: "A bundle can only group listings from one supplier." as const };
  }
  const image = input.image.trim() || first.image;
  const published = publishListing(account.id, {
    productId: input.productId,
    sku: input.sku,
    title: input.title,
    description: input.description,
    priceCents: input.priceCents,
    image,
    supplierName: first.supplierName,
    supplierOrigin: first.supplierOrigin,
    shipDaysMin: Math.min(...pieces.map((item) => item.shipDaysMin)),
    shipDaysMax: Math.max(...pieces.map((item) => item.shipDaysMax)),
    published: true,
    madeInUsa: pieces.every((item) => item.madeInUsa),
    shelf: pieces.every((item) => item.shelf === "small") ? "small" : "national",
    supplierAccountId: first.supplierAccountId,
    supplierCostCents: pieces.reduce((sum, item) => sum + item.supplierCostCents, 0),
    supplierShippingCents: pieces.reduce((sum, item) => sum + item.supplierShippingCents, 0),
    feeBps: first.feeBps,
    catalogItemId: null,
    route: first.route,
    supplierOrderUrl: first.supplierOrderUrl,
    supplierEmail: first.supplierEmail,
    aisle: input.aisle,
  });
  if ("error" in published) return published;
  if (!published.listing) return { error: "That bundle did not save." as const };
  const db = getDb();
  db.prepare("UPDATE listings SET kind = 'bundle' WHERE product_id = ?").run(input.productId);
  db.prepare("DELETE FROM bundle_items WHERE bundle_id = ?").run(input.productId);
  const insert = db.prepare("INSERT INTO bundle_items (bundle_id, product_id, position) VALUES (?, ?, ?)");
  itemIds.forEach((id, index) => insert.run(input.productId, id, index));
  return { listing: getListing(input.productId) };
}

export function saveListingCheck(
  productId: string,
  input: { checkedBy: string; checkedOn: string; checkedNote: string },
) {
  const listing = getListing(productId);
  if (!listing) return { error: "That page is not on the store." as const };
  const checkedBy = input.checkedBy.trim().replace(/\s+/g, " ");
  const checkedOn = input.checkedOn.trim();
  const checkedNote = input.checkedNote.replace(/\r\n/g, "\n").trim();
  if (!checkedBy && !checkedOn && !checkedNote) {
    getDb()
      .prepare("UPDATE listings SET checked_by = NULL, checked_on = NULL, checked_note = NULL WHERE product_id = ?")
      .run(productId);
    return { listing: getListing(productId) };
  }
  if (!checkedBy || checkedBy.length > 80) return { error: "Name who checked it, in 80 characters or fewer." as const };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkedOn)) return { error: "Use the check date as YYYY-MM-DD." as const };
  const [year, month, day] = checkedOn.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { error: "That check date is not a real day." as const };
  }
  if (!checkedNote || checkedNote.length > 400) return { error: "Write what you noticed, in 400 characters or fewer." as const };
  const struck = compareAtRejection({ checkedBy, checkedOn, checkedNote });
  if (struck) return { error: struck };
  getDb()
    .prepare("UPDATE listings SET checked_by = ?, checked_on = ?, checked_note = ? WHERE product_id = ?")
    .run(checkedBy, checkedOn, checkedNote, productId);
  return { listing: getListing(productId) };
}

export function getListing(productId: string) {
  const row = getDb().prepare("SELECT * FROM listings WHERE product_id = ?").get(productId) as ListingRow | undefined;
  return row ? listingFrom(row) : null;
}

export function listPublished(filter?: { madeInUsa?: boolean; shelf?: "national" | "small"; aisle?: string }) {
  const clauses = ["published = 1", "COALESCE(hidden_from_shop, 0) = 0"];
  const params: Array<string | number> = [];
  if (filter?.madeInUsa) clauses.push("made_in_usa = 1");
  if (filter?.shelf) {
    clauses.push("shelf = ?");
    params.push(filter.shelf);
  }
  if (filter?.aisle === "bundles") {
    clauses.push("kind = 'bundle'");
  } else if (filter?.aisle) {
    clauses.push("aisle = ?");
    params.push(filter.aisle);
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
    sellerAccountId: listing.accountId,
  });
  return { split };
}

export function listingLoss(listing: StoreListing) {
  if (listing.wholesaleCost != null) {
    const guarded = marginGuard(listing.priceCents, listing.wholesaleCost);
    if (guarded) return guarded;
  }
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
  const listing = getDb()
    .prepare("SELECT * FROM listings WHERE product_id = ? AND published = 1 AND COALESCE(hidden_from_shop, 0) = 0")
    .get(input.productId) as
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
  if (
    isWoodTrayListing(page) ||
    isScentedCandleListing(page) ||
    isHeldSample(page) ||
    (isQaCheckoutListing(page) && !qaCheckoutSeedAllowed())
  ) {
    return { error: "That page is not on the store." as const };
  }
  if (page.wholesaleCost != null) {
    const guarded = marginGuard(page.priceCents, page.wholesaleCost);
    if (guarded) {
      pauseListing(page.productId);
      return { error: guarded };
    }
  }
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
  const returnTo = resolveReturnAddress(page);
  getDb()
    .prepare(
      `INSERT INTO orders (
         id, number, product_id, account_id, customer_name, email, qty, amount_cents,
         ship_line1, ship_city, ship_region, ship_postal, ship_country,
         stripe_session_id, status, supplier_ref, supplier_detail, created_at,
         transfer_group, fee_bps, platform_fee_cents, supplier_amount_cents, reseller_amount_cents, supplier_account_id,
         receipt_token_hash, stripe_fee_est_cents, stripe_fee_cents,
         return_line1, return_city, return_region, return_postal, return_country
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      returnTo?.line1 ?? null,
      returnTo?.city ?? null,
      returnTo?.region ?? null,
      returnTo?.postal ?? null,
      returnTo?.country ?? null,
    );
  snapshotOrderCost(id, page.productId, qty, page.priceCents);
  return { order: getOrder(id)!, listing: listingFrom(listing), receiptToken };
}

export function attachStripeSession(orderId: string, sessionId: string) {
  getDb().prepare("UPDATE orders SET stripe_session_id = ? WHERE id = ?").run(sessionId, orderId);
}

export function orderByStripeSession(sessionId: string) {
  if (!sessionId) return null;
  const row = getDb().prepare("SELECT id FROM orders WHERE stripe_session_id = ?").get(sessionId) as
    | { id: string }
    | undefined;
  return row ? getOrder(row.id) : null;
}

const LINK_COLUMNS = {
  customer_link_hash: "customer_link_hash",
  ship_link_hash: "ship_link_hash",
  delay_refund_token_hash: "delay_refund_token_hash",
} as const;

export function issueOrderToken(orderId: string, column: keyof typeof LINK_COLUMNS) {
  const token = randomBytes(32).toString("hex");
  const name = LINK_COLUMNS[column];
  getDb().prepare(`UPDATE orders SET ${name} = ? WHERE id = ?`).run(receiptHash(token), orderId);
  return token;
}

export function orderByReceiptToken(token: string) {
  if (!token || token.length < 32) return null;
  const hash = receiptHash(token);
  const row = getDb()
    .prepare(
      "SELECT id FROM orders WHERE receipt_token_hash = ? OR customer_link_hash = ? OR ship_link_hash = ?",
    )
    .get(hash, hash, hash) as { id: string } | undefined;
  return row ? getOrder(row.id) : null;
}

export function orderByDelayToken(token: string) {
  if (!token || token.length < 32) return null;
  const row = getDb().prepare("SELECT id FROM orders WHERE delay_refund_token_hash = ?").get(receiptHash(token)) as
    | { id: string }
    | undefined;
  return row ? getOrder(row.id) : null;
}

export function markShipped(
  orderId: string,
  carrier: string,
  tracking: string,
  options?: { byAdmin?: boolean },
) {
  const carrierName = carrier.trim();
  const trackingNumber = tracking.trim();
  if (carrierName.length < 2 || carrierName.length > 40) return { error: "Name the carrier." as const };
  if (!/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber)) {
    return { error: "Add a tracking number made of letters, numbers, and dashes." as const };
  }
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (order.status === "pending") return { error: "This order is not paid." as const };
  if (isBlockedTestOrder(order.number) || order.status === "test") {
    return { error: "This test order must not be placed with a supplier." as const };
  }
  const now = Date.now();
  const firstShip = !order.shippedAt;
  const trackingChanged = order.trackingNumber !== trackingNumber;
  const nextStatus = order.deliveredAt || order.status === "delivered" ? order.status : "shipped";
  getDb()
    .prepare(
      `UPDATE orders
       SET carrier = ?,
           tracking_number = ?,
           shipped_at = COALESCE(shipped_at, ?),
           tracking_updated_at = CASE WHEN ? = 1 THEN ? ELSE tracking_updated_at END,
           status = ?
       WHERE id = ?`,
    )
    .run(carrierName, trackingNumber, now, options?.byAdmin ? 1 : 0, now, nextStatus, orderId);
  if ((firstShip || trackingChanged) && nextStatus === "shipped" && !isBlockedTestOrder(order.number)) {
    const token = issueOrderToken(orderId, "ship_link_hash");
    void sendShippedMail({
      to: order.email,
      number: order.number,
      title: order.title ?? "Order",
      carrier: carrierName,
      tracking: trackingNumber,
      token,
    });
  }
  return { order: getOrder(orderId)! };
}

export function placeSupplierOrder(orderId: string, input: { supplierRef: string; supplierCostCents: number }) {
  const order = getOrder(orderId);
  if (!order) return { error: "That order is not on file." as const };
  if (isBlockedTestOrder(order.number) || order.status === "test") {
    return { error: "This test order must not be placed with a supplier." as const };
  }
  if (order.status !== "needs_placing") return { error: "This order is not waiting to be placed." as const };
  const supplierRef = input.supplierRef.trim();
  if (!/^[A-Za-z0-9-]{2,40}$/.test(supplierRef)) return { error: "Enter the supplier order number." as const };
  if (!Number.isInteger(input.supplierCostCents) || input.supplierCostCents < 0 || input.supplierCostCents > 10_000_000) {
    return { error: "Enter the amount paid to the supplier." as const };
  }
  const updated = changed(
    getDb()
      .prepare(
        `UPDATE orders
         SET status = 'ordered', supplier_ref = ?, supplier_paid_cents = ?, placed_at = ?, supplier_detail = ?
         WHERE id = ? AND status = 'needs_placing'`,
      )
      .run(supplierRef, input.supplierCostCents, Date.now(), "Ordered with the supplier.", orderId),
  );
  if (updated !== 1) return { error: "This order is not waiting to be placed." as const };
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

function paidNotice(order: StoreOrder, listing: StoreListing | null) {
  return {
    number: order.number,
    title: routedTitle(order, listing),
    sku: order.sku ?? listing?.sku ?? order.productId,
    qty: order.qty,
    supplierOrderUrl: isBlockedTestOrder(order.number) ? null : (listing?.supplierOrderUrl ?? null),
  };
}

async function finishManual(order: StoreOrder, listing: StoreListing | null) {
  changed(
    getDb()
      .prepare(
        "UPDATE orders SET status = 'needs_placing', supplier_detail = ? WHERE id = ? AND status = 'fulfilling'",
      )
      .run("Paid. We're placing this with the supplier.", order.id),
  );
  await sendOpsAlert({ kind: "new", ...paidNotice(order, listing) });
}

async function finishEmail(order: StoreOrder, listing: StoreListing | null) {
  if (!listing?.supplierEmail) {
    await finishManual(order, listing);
    return;
  }
  changed(
    getDb()
      .prepare(
        "UPDATE orders SET status = 'sent_to_supplier', supplier_detail = ? WHERE id = ? AND status = 'fulfilling'",
      )
      .run("Sent to the brand.", order.id),
  );
  await sendBrandOrder({
    to: listing.supplierEmail,
    number: order.number,
    sku: order.sku ?? listing.sku,
    title: routedTitle(order, listing),
    qty: order.qty,
    shipTo: {
      name: order.customerName,
      email: order.email,
      line1: order.shipLine1,
      city: order.shipCity,
      region: order.shipRegion,
      postal: order.shipPostal,
      country: order.shipCountry,
    },
  });
  await sendOpsAlert({ kind: "email-copy", ...paidNotice(order, listing) });
}

async function finishApi(order: StoreOrder, listing: StoreListing | null) {
  const result = await requestShipment({
    orderId: order.id,
    number: order.number,
    sku: listing?.sku ?? order.productId,
    title: listing?.title ?? "Listing",
    qty: order.qty,
    supplierName: listing?.supplierName ?? "Supplier",
    shipTo: {
      name: order.customerName,
      email: order.email,
      line1: order.shipLine1,
      city: order.shipCity,
      region: order.shipRegion,
      postal: order.shipPostal,
      country: order.shipCountry,
    },
  });
  changed(
    getDb()
      .prepare("UPDATE orders SET status = ?, supplier_ref = ?, supplier_detail = ? WHERE id = ? AND status = 'fulfilling'")
      .run(result.status, result.ref, result.detail, order.id),
  );
}

export async function fulfillPaidOrder(orderId: string) {
  const db = getDb();
  const claim = changed(
    db.prepare(
      "UPDATE orders SET status = 'fulfilling', fulfilling_started_at = ? WHERE id = ? AND status = 'paid'",
    ).run(Date.now(), orderId),
  );
  if (claim !== 1) return getOrder(orderId);
  const order = getOrder(orderId);
  if (!order) return null;
  const listing = getListing(order.productId);
  if (isBlockedTestOrder(order.number)) {
    db.prepare(
      "UPDATE orders SET status = 'test', supplier_ref = NULL, supplier_detail = ? WHERE id = ? AND status = 'fulfilling'",
    ).run("Test order. Do not place this with a supplier.", orderId);
    return getOrder(orderId);
  }
  const route = parseListingRoute(listing?.route);
  try {
    switch (route) {
      case "manual":
        await finishManual(order, listing);
        break;
      case "email":
        await finishEmail(order, listing);
        break;
      case "api":
        await finishApi(order, listing);
        break;
      default: {
        const _never: never = route;
        throw new Error(`Unknown route ${_never}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "The order was not routed.");
    db.prepare(
      "UPDATE orders SET status = 'needs_placing', supplier_detail = ? WHERE id = ? AND status = 'fulfilling'",
    ).run("Paid. We're placing this with the supplier.", orderId);
  }
  const current = getOrder(orderId);
  if (current && !isBlockedTestOrder(current.number) && current.status !== "test") {
    const token = issueOrderToken(orderId, "customer_link_hash");
    await sendCustomerReceipt({
      to: current.email,
      number: current.number,
      title: current.title ?? listing?.title ?? "Order",
      qty: current.qty,
      amountCents: current.amountCents,
      shipsFrom: listing?.shipsFrom ?? null,
      eta: etaFromListing(listing),
      shipDaysMin: listing?.shipDaysMin ?? 0,
      shipDaysMax: listing?.shipDaysMax ?? 0,
      supplierName: listing?.supplierName ?? null,
      supplierUsConfirmed: listing?.supplierUsConfirmed ?? false,
      token,
      productId: current.productId,
      returnAddress: formatOrderReturn(current),
    });
  }
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
  const alerts: { id: string; number: string; kind: "refund" | "nearing" | "reserve" }[] = [];
  for (const row of rows) {
    if (row.refund_required === 1) {
      alerts.push({ id: row.id, number: row.number, kind: "refund" });
      continue;
    }
    if (holdState(row.paid_at, now) === "nearing") alerts.push({ id: row.id, number: row.number, kind: "nearing" });
  }
  const stuckReserves = getDb()
    .prepare("SELECT id, number FROM orders WHERE reserve_release_flag = 'connect'")
    .all() as { id: string; number: string }[];
  for (const row of stuckReserves) alerts.push({ id: row.id, number: row.number, kind: "reserve" });
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
