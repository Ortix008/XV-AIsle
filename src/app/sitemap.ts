import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { appOrigin } from "@/lib/server/stripe";
import { visibleOnShop } from "@/lib/server/starter-shelf";
import { listPublished } from "@/lib/server/store";

export const dynamic = "force-dynamic";

const PUBLIC_PATHS = [
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
  "/shop/order",
  "/shop/return",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const origin = appOrigin();
  const pages = [
    ...PUBLIC_PATHS.map((path) => `${origin}${path}`),
    `${origin}/shop?aisle=bundles`,
  ];
  const products = listPublished()
    .filter((listing) => visibleOnShop(listing))
    .map((listing) => `${origin}/shop/${listing.productId}`);
  return [...pages, ...products].map((url) => ({ url }));
}
