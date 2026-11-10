import type { NightWorldSlug } from "@/lib/night-worlds";

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function NightMotif({ slug, className }: { slug: NightWorldSlug; className?: string }) {
  switch (slug) {
    case "everyday-finds":
      return (
        <svg {...stroke} className={className}>
          <path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" />
          <path d="M5.5 8.5h13l-1.35 9.2a1.3 1.3 0 0 1-1.3 1.1H8.15a1.3 1.3 0 0 1-1.3-1.1L5.5 8.5z" />
        </svg>
      );
    case "tech-and-desk":
      return (
        <svg {...stroke} className={className}>
          <path d="M4.5 12.5c2.2-4.2 12.8-4.2 15 0" />
          <path d="M12 12.5V18" />
          <path d="M8 20h8" />
        </svg>
      );
    case "home-and-gifts":
      return (
        <svg {...stroke} className={className}>
          <rect x="4" y="11" width="16" height="9" rx="1.2" />
          <path d="M4 15h16" />
          <path d="M12 11v9" />
          <path d="M12 11c-2.2-3.2-6.2-1.6-4.4.6" />
          <path d="M12 11c2.2-3.2 6.2-1.6 4.4.6" />
        </svg>
      );
    case "bundles":
      return (
        <svg {...stroke} className={className}>
          <rect x="7" y="8.5" width="13" height="11" rx="1.2" />
          <path d="M4 15.5V4.5h13" />
        </svg>
      );
    default: {
      const exhaustive: never = slug;
      return exhaustive;
    }
  }
}
