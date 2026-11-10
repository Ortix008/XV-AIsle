import { sampleStarters } from "../src/lib/sample-shelf";
import { hasRealProductPhoto, shopCardsWithPhotos, SHOP_PLACEHOLDER_PHOTOS } from "../src/lib/shop-photo";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(hasRealProductPhoto("") === false, "an empty image is not a product photo");
assert(hasRealProductPhoto("   ") === false, "a blank image is not a product photo");
assert(hasRealProductPhoto(null) === false, "a missing image is not a product photo");
assert(hasRealProductPhoto(undefined) === false, "an unset image is not a product photo");

for (const asset of SHOP_PLACEHOLDER_PHOTOS) {
  assert(hasRealProductPhoto(asset) === false, `${asset} is the shared fallback`);
  assert(hasRealProductPhoto(`${asset}?v=1`) === false, `${asset} stays a fallback with a query`);
}

assert(hasRealProductPhoto("/art/mock-sheet-pan-1.png"), "a product file under /art is a real photo");
assert(hasRealProductPhoto("  /art/mock-bench-scraper-1.png  "), "a real photo can have surrounding space");

for (const item of sampleStarters) {
  assert(hasRealProductPhoto(item.image), `${item.productId} in the sample shelf has a real photo`);
}

const cards = [
  { productId: "pan", image: "/art/mock-sheet-pan-1.png" },
  { productId: "blank", image: "" },
  { productId: "mark", image: "/xv-aisle-mark.svg" },
  { productId: "glow", image: "/brand/hero-aisle-pedestals.webp" },
  { productId: "scraper", image: "/art/mock-bench-scraper-1.png" },
];
const shown = shopCardsWithPhotos(cards);
assert(
  shown.map((card) => card.productId).join() === "pan,scraper",
  "the shop grid keeps only cards with a real photo, in order",
);

console.log("shop photo filter checks ok", { shown: shown.length, hidden: cards.length - shown.length });
