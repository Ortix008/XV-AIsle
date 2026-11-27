import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AffiliateSpot } from "../src/components/affiliate-spot";
import { AisleDetail } from "../src/components/amazon-aisles";
import { AFFILIATE_OFFERS, BOOKSHOP_OFFER_HREF } from "../src/config/affiliates";
import { AMAZON_AISLES, amazonPickUrl, liveAisleBySlug } from "../src/lib/amazon-aisles";
import { NEW_PICK_COPY } from "../src/lib/new-pick-copy";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const amazonHrefs = {
  B08R6KMBQT: "https://www.amazon.com/dp/B08R6KMBQT/?tag=xvaisle-20",
  B0CFPJYX7P: "https://www.amazon.com/dp/B0CFPJYX7P/?tag=xvaisle-20",
  B003PWNH4Q: "https://www.amazon.com/dp/B003PWNH4Q/?tag=xvaisle-20",
  B00EVY54IE: "https://www.amazon.com/dp/B00EVY54IE/?tag=xvaisle-20",
  B0010TEFFQ: "https://www.amazon.com/dp/B0010TEFFQ/?tag=xvaisle-20",
  B0BPLVSB26: "https://www.amazon.com/dp/B0BPLVSB26/?tag=xvaisle-20",
  B0CSNWJKW6: "https://www.amazon.com/dp/B0CSNWJKW6/?tag=xvaisle-20",
  B0C4Z7RTLP: "https://www.amazon.com/dp/B0C4Z7RTLP/?tag=xvaisle-20",
  B0BDDHGC2F: "https://www.amazon.com/dp/B0BDDHGC2F/?tag=xvaisle-20",
  B0CC8DS2S5: "https://www.amazon.com/dp/B0CC8DS2S5/?tag=xvaisle-20",
  B0CD59K7PX: "https://www.amazon.com/dp/B0CD59K7PX/?tag=xvaisle-20",
} as const;

for (const [asin, href] of Object.entries(amazonHrefs)) {
  assert(amazonPickUrl(asin) === href, `${asin} link`);
  const url = new URL(href);
  assert(url.protocol === "https:" && url.hostname === "www.amazon.com", `${asin} host`);
  assert(url.searchParams.get("tag") === "xvaisle-20", `${asin} tag`);
}

for (const asin of ["B0BPLFGJ3B", "B07QSXHZPF", "B00O3GZHZ0"]) {
  const href = amazonPickUrl(asin);
  assert(href === `https://www.amazon.com/dp/${asin}?tag=xvaisle-20`, `${asin} stays on tag=xvaisle-20`);
}

const bookshop = AFFILIATE_OFFERS.find((offer) => offer.id === "bookshop");
assert(bookshop?.href === BOOKSHOP_OFFER_HREF && bookshop.partnerId === "131173", "Bookshop offer");
const bookHrefs = [
  "https://bookshop.org/a/131173/9781476753836",
  "https://bookshop.org/a/131173/9781607749165",
  "https://bookshop.org/a/131173/9780735211292",
  "https://bookshop.org/a/131173/9780358414230",
];
assert(bookshop?.picks?.map((pick) => pick.href).join() === bookHrefs.join(), "Bookshop book links");
for (const href of [BOOKSHOP_OFFER_HREF, ...bookHrefs]) {
  const url = new URL(href);
  assert(url.protocol === "https:" && url.hostname === "bookshop.org", href);
  assert(url.pathname.startsWith("/a/131173"), href);
}

const tours = AFFILIATE_OFFERS.find((offer) => offer.id === "getyourguide")?.picks ?? [];
const tourHrefs = [
  "https://www.getyourguide.com/orlando-l191/kennedy-space-center-tour-t11881/?partner_id=YEH3QKQ&mkt_cmp=true",
];
assert(tours.map((pick) => pick.href).join() === tourHrefs.join(), "GetYourGuide tour links");
for (const href of tourHrefs) {
  const url = new URL(href);
  assert(url.protocol === "https:" && url.hostname === "www.getyourguide.com", href);
  assert(url.searchParams.get("partner_id") === "YEH3QKQ", href);
}

const src = readFileSync(join(process.cwd(), "src/config/affiliates.ts"), "utf8") + readFileSync(join(process.cwd(), "src/lib/amazon-aisles.ts"), "utf8");
assert(!/ebay\.com/i.test(src), "no eBay links");

const visible = [
  ...Object.values(NEW_PICK_COPY.amazon).flatMap((copy) => [copy.name, copy.why]),
  ...Object.values(NEW_PICK_COPY.books).flatMap((copy) => [copy.name, copy.why]),
  ...Object.values(NEW_PICK_COPY.tours).flatMap((copy) => [copy.name, copy.why]),
].join("\n");
const banned = /\bfree\b|glare-free|Free cancellation|\bflannel\b/i;
assert(!banned.test(visible), "new pick copy has no free, glare-free, Free cancellation, or flannel");

for (const slug of ["kitchen", "electronics", "home-and-cozy", "games-and-hobbies"]) {
  const aisle = liveAisleBySlug(slug);
  assert(aisle, slug);
  const html = renderToStaticMarkup(createElement(AisleDetail, { aisle }));
  assert(!/\$\s*\d/.test(html), `${slug} shows no price`);
  assert(!/\b(?:ratings?|reviews?|stars?)\b|★/i.test(html), `${slug} shows no rating`);
  assert(html.includes("See price on Amazon"), `${slug} keeps the Amazon button`);
}
const books = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "books" }));
const experiences = renderToStaticMarkup(createElement(AffiliateSpot, { spot: "experiences" }));
assert(!/\$\s*\d/.test(books + experiences), "partner cards show no price");
assert(!banned.test(books + experiences), "rendered partner cards pass the free scan");
assert(books.includes('rel="sponsored nofollow noopener noreferrer"'), "book links are sponsored and nofollow");
assert(experiences.includes('rel="sponsored nofollow noopener noreferrer"'), "GetYourGuide links are sponsored and nofollow");
assert(experiences.includes('rel="sponsored noopener noreferrer"'), "Viator keeps its existing rel");
for (const text of [
  "See Salt, Fat, Acid, Heat on Bookshop.org",
  "See Ottolenghi Simple on Bookshop.org",
  "See Atomic Habits on Bookshop.org",
  "See Dog Is Love on Bookshop.org",
  "Browse books on Bookshop.org",
]) {
  assert(books.includes(text), `books render ${text}`);
}
for (const text of [
  "See the Kennedy Space Center trip on GetYourGuide",
  "See things to do on GetYourGuide",
  "See things to do on Viator",
]) {
  assert(experiences.includes(text), `tours render ${text}`);
}
assert(!experiences.includes("See the Everglades airboat ride on GetYourGuide"), "the Everglades card no longer uses the GetYourGuide label");
assert(experiences.includes("Kennedy Space Center Trip from Orlando with Transport"), "Kennedy card uses the approved title");
assert(experiences.includes("Everglades Airboat Ride and Wildlife Park"), "the Everglades name stays");
assert(experiences.includes("Clear Kayak Tour, Tarpon Springs"), "the Tarpon Springs kayak card renders");
assert(experiences.includes("Little Toot Dolphin Cruise, Clearwater"), "the Little Toot card renders");
assert(experiences.includes("5467OHEP") && experiences.includes("173028P2") && experiences.includes("179637P1"), "Viator tour codes are on the cards");

for (const aisle of AMAZON_AISLES) {
  for (const item of aisle.items) {
    assert(!item.imageUrl, `${item.asin} has no product image`);
  }
}

console.log("partner link checks ok");
console.log("free scan: no free, glare-free, Free cancellation, or flannel in the new pick copy");
