import type { MetadataRoute } from "next";
import { AGENT_TOKENS } from "@/lib/agent-traffic";

const PRIVATE_PREFIXES = ["/api", "/membership", "/orders", "/account"];

function group(userAgent: string) {
  return {
    userAgent,
    allow: "/",
    disallow: PRIVATE_PREFIXES,
  };
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PREFIXES,
      },
      ...AGENT_TOKENS.map((userAgent) => group(userAgent)),
    ],
    sitemap: "https://xvaisle.com/sitemap.xml",
  };
}
