import type { MetadataRoute } from "next";

const PRIVATE_PREFIXES = [
  "/account",
  "/desk",
  "/api",
  "/scout",
  "/listings",
  "/marketing",
  "/floors",
  "/catalog",
  "/membership",
  "/orders",
  "/shop/reseller",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PREFIXES,
    },
  };
}
