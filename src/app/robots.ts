import type { MetadataRoute } from "next";

const PRIVATE_PREFIXES = ["/api", "/membership", "/orders"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: PRIVATE_PREFIXES,
    },
  };
}
