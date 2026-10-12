import { nightWorldBySlug, nightWorldForListing, nightWorlds } from "../src/lib/night-worlds";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const slugs = ["build-your-rig", "tech-and-desk", "home-and-gifts", "bundles"] as const;
assert(nightWorlds.length === slugs.length, "four night stalls");
for (const slug of slugs) {
  const world = nightWorldBySlug(slug);
  assert(world?.story && world.story.length > 24 && world.story.length < 140, `${slug} has one honest line`);
  assert(/^#[0-9a-f]{6}$/i.test(world?.accent ?? ""), `${slug} has a lamp color`);
}

assert(nightWorldForListing({ kind: "bundle", aisle: "build-your-rig" })?.slug === "bundles", "a bundle keeps the bundles lamp");
assert(nightWorldForListing({ aisle: "tech-and-desk" })?.slug === "tech-and-desk", "a desk listing uses the desk lamp");
assert(nightWorldForListing({ aisle: "kitchen" }) === null, "an older aisle keeps the house lamp");
assert(nightWorldForListing({}) === null, "a listing with no stall has no lamp");

const hype = /\b(reviews?|ratings?|stars?|hurry|countdown|discount|you save|was \$|only \d+ left|%\s*off)\b/i;
for (const world of nightWorlds) {
  assert(!hype.test(world.story), `${world.title} stays free of hype`);
}

console.log("night boutique checks ok");
