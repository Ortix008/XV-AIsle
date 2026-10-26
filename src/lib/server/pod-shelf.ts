import { POD_PLACEHOLDER_IMAGE, podPlaceholder, podShelfItems } from "../pod-shelf";
import { getDb } from "./db";
import { getListing, publishListing } from "./store";

const POD_SHELF_ACCOUNT_ID = "pod-shelf";
const POD_SHELF_EMAIL = "pod-shelf@example.test";

/** Not a password. Sign-in rejects a hash of the wrong length. */
const UNUSABLE_PASSWORD = "00";

type PodSeedEnv = {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
};

/** Local and preview boots may insert missing rows. A production deploy does not. */
export function podSeedAllowed(env: PodSeedEnv = process.env) {
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview") return false;
  return true;
}

function podShelfAccountId() {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM accounts WHERE email = ?").get(POD_SHELF_EMAIL) as { id: string } | undefined;
  if (existing) return existing.id;
  db.prepare(
    `INSERT INTO accounts (
       id, name, email, password_hash, password_salt, created_at, role, email_verified
     ) VALUES (?, 'POD shelf', ?, ?, ?, ?, 'buyer', 0)`,
  ).run(POD_SHELF_ACCOUNT_ID, POD_SHELF_EMAIL, UNUSABLE_PASSWORD, UNUSABLE_PASSWORD, Date.now());
  return POD_SHELF_ACCOUNT_ID;
}

/**
 * Insert each approved row once. A later title, price, or confirmation is left alone.
 * Returns the number of rows inserted on this call.
 */
export function ensurePodShelf(env: PodSeedEnv = process.env) {
  if (!podSeedAllowed(env)) return 0;
  const accountId = podShelfAccountId();
  let inserted = 0;
  for (const item of podShelfItems) {
    if (getListing(item.productId)) continue;
    const saved = publishListing(accountId, {
      productId: item.productId,
      sku: item.sku,
      title: podPlaceholder(item.name),
      description: podPlaceholder(item.name),
      priceCents: item.priceCents,
      image: POD_PLACEHOLDER_IMAGE,
      supplierName: item.supplierName,
      supplierOrigin: "",
      shipDaysMin: 0,
      shipDaysMax: 0,
      madeInUsa: false,
      shelf: "national",
      published: true,
      supplierUsConfirmed: false,
    });
    if ("error" in saved || !saved.listing) {
      console.error("POD shelf did not publish.", item.productId, "error" in saved ? saved.error : "missing");
      continue;
    }
    inserted += 1;
  }
  return inserted;
}
