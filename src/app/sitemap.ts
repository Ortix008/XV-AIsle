import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { isQaCheckoutListing } from "@/lib/qa-checkout";
import { visibleOnShop } from "@/lib/server/starter-shelf";
import { appOrigin } from "@/lib/server/stripe";
import { listPublished } from "@/lib/server/store";
import { comingSoonListing } from "@/lib/supplier-confirm";

export const dynamic = "force-dynamic";

export const SITEMAP_PATHS = [
  "/",
  "/shop",
  "/shop/small",
  "/shop/how-we-check",
  "/shop/shipping",
  "/shop/returns",
  "/shop/contact",
  "/shop/safety",
  "/shop/privacy",
  "/shop/terms",
  "/sign-in",
  "/sign-up",
];

/** Public product URLs. Token pages, the QA fixture, and Coming soon rows stay out. */
export function sitemapListsProduct(listing: {
  productId: string;
  supplierName: string;
  published: boolean;
  hiddenFromShop?: boolean;
  title?: string | null;
  shipsFrom?: string | null;
  supplierUsConfirmed?: boolean | null;
}) {
  if (isQaCheckoutListing(listing)) return false;
  if (!visibleOnShop(listing)) return false;
  if (comingSoonListing(listing)) return false;
  return true;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = appOrigin();
  const pages = [
    ...SITEMAP_PATHS.map((path) => `${origin}${path}`),
    `${origin}/shop?aisle=bundles`,
  ];
  const products = listPublished()
    .filter(sitemapListsProduct)
    .map((listing) => `${origin}/shop/${listing.productId}`);
  return [...pages, ...products].map((url) => ({ url }));
}
