/** Night Boutique stalls. Accents are decorative lamps, not prices or warnings. */

export const nightWorldSlugs = ["build-your-rig", "tech-and-desk", "home-and-gifts", "bundles"] as const;

export type NightWorldSlug = (typeof nightWorldSlugs)[number];

export type NightWorld = {
  slug: NightWorldSlug;
  title: string;
  story: string;
  accent: string;
  glow: string;
  wash: string;
};

export const nightWorlds: readonly NightWorld[] = [
  {
    slug: "build-your-rig",
    title: "Build Your Rig",
    story: "Headphones and phone cases we placed here because they belong on a setup.",
    accent: "#3ddc84",
    glow: "rgba(61, 220, 132, 0.22)",
    wash: "rgba(61, 220, 132, 0.09)",
  },
  {
    slug: "tech-and-desk",
    title: "Tech & Desk",
    story: "A lamp and a cable sleeve for the desk that is already there.",
    accent: "#e7c27a",
    glow: "rgba(231, 194, 122, 0.2)",
    wash: "rgba(231, 194, 122, 0.08)",
  },
  {
    slug: "home-and-gifts",
    title: "Home & Gifts",
    story: "Bags to give and jars to keep. Pieces chosen for a home that feels lived-in.",
    accent: "#e3b4c4",
    glow: "rgba(227, 180, 196, 0.2)",
    wash: "rgba(227, 180, 196, 0.08)",
  },
  {
    slug: "bundles",
    title: "Bundles",
    story: "Pieces from one supplier, sold together at the one price an operator set.",
    accent: "#7ddec4",
    glow: "rgba(125, 222, 196, 0.2)",
    wash: "rgba(125, 222, 196, 0.08)",
  },
];

const bySlug = new Map(nightWorlds.map((world) => [world.slug, world]));
const byTitle = new Map(nightWorlds.map((world) => [world.title, world]));

export function nightWorldBySlug(slug: string) {
  return bySlug.get(slug as NightWorldSlug) ?? null;
}

export function nightWorldByTitle(title: string) {
  return byTitle.get(title) ?? null;
}

/** A bundle keeps the Bundles lamp even when it also sits in another aisle. */
export function nightWorldForListing(listing: { kind?: string | null; aisle?: string | null }) {
  if (listing.kind === "bundle") return bySlug.get("bundles") ?? null;
  if (!listing.aisle) return null;
  return nightWorldBySlug(listing.aisle);
}

export function nightWorldVars(world: NightWorld) {
  return {
    "--world": world.accent,
    "--world-glow": world.glow,
    "--world-wash": world.wash,
  };
}
