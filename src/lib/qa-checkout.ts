/** Preview-only checkout fixture. This id is reserved and never belongs on the live shelf. */
export const QA_CHECKOUT_PRODUCT_ID = "qa-checkout";

export const QA_SUPPLIER_EMAIL = "qa-supplier@xvaisle.test";

export function isQaCheckoutListing(listing: { productId: string }) {
  return listing.productId === QA_CHECKOUT_PRODUCT_ID;
}

type SeedEnv = {
  DEMO_SEED?: string;
  VERCEL_ENV?: string;
  NODE_ENV?: string;
};

/** Same gate as the demo shelf: DEMO_SEED=1, and never a production deploy. */
export function qaCheckoutSeedAllowed(env: SeedEnv = process.env) {
  if (env.DEMO_SEED !== "1") return false;
  if (env.VERCEL_ENV === "production") return false;
  if (env.NODE_ENV === "production" && env.VERCEL_ENV !== "preview") return false;
  return true;
}

/** True when this row must stay off the shelf and out of checkout. */
export function qaCheckoutBlockedOnShelf(listing: { productId: string }, env: SeedEnv = process.env) {
  return isQaCheckoutListing(listing) && !qaCheckoutSeedAllowed(env);
}
