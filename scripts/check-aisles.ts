import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AisleDetail, AisleIndex } from "../src/components/amazon-aisles";
import { JoinScreen } from "../src/components/home-screen";
import { ShopFooter } from "../src/components/shop-footer";
import AislesPage from "../src/app/aisles/page";
import { ShopScreen } from "../src/app/shop/page";
import { storeNav, storeNavCurrent } from "../src/components/store-header";
import {
  AI_SHOPPERS_NOTE,
  AISLE_INDEX_COPY,
  AISLE_CARD_ALT,
  AMAZON_AISLES,
  AMAZON_ASSOCIATE_DISCLOSURE,
  AMAZON_PAID_LINK_LABEL,
  AMAZON_PICK_BUTTON_LABEL,
  LLMS_SUMMARY,
  amazonPickUrl,
  liveAisleBySlug,
  liveAislePaths,
  liveAisles,
  llmsTxt,
  qaPickRows,
  resolvePickImage,
  type AmazonAisle,
  type AmazonPick,
} from "../src/lib/amazon-aisles";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const PRICE = /\$\s*\d/;
const RATING = /\b(?:ratings?|reviews?|stars?)\b|★|☆|\bout of 5\b/i;
const FORBIDDEN_KEYS = new Set([
  "offers",
  "price",
  "pricecurrency",
  "aggregaterating",
  "review",
  "image",
  "rating",
  "ratingvalue",
  "reviewcount",
]);
const HERO_SUBHEAD = "Every item is reviewed before it's listed, and tracking is emailed when it ships.";
const COMING_SOON = ["Coming", "soon"].join(" ");
const WE_EARN = ["we", "earn"].join(" ");
const OLD_DISCLOSURE = ["As an Amazon Associate, XV-AIsle", "earns from qualifying purchases."].join(" ");
const GIFTS_PATH = `/${"gifts"}`;
const BLOCKED_COPY = [HERO_SUBHEAD, "14-day", "14 days", "3 to 8", "3–8", "3-8 day", COMING_SOON];
const AMAZON_IMAGE = /images-amazon\.com|ssl-images-amazon|media-amazon\.com|m\.media-amazon/i;
const LINK = /^https:\/\/www\.amazon\.com\/dp\/[A-Z0-9]{10}\?tag=xvaisle-20$/;

const EXPECTED_BLURBS: Record<string, string> = {
  B00006JSUA: "A 10.25-inch cast iron skillet, pre-seasoned and ready for the first family breakfast.",
  B000N501BK: "A 6-quart enameled cast iron Dutch oven in Island Spice Red, made for slow Sunday stews.",
  B00004S7V8: "A classic zester and grater, a little tool for anyone who loves to cook.",
  B0764HS4SL: "A 4-in-1 vegetable chopper and spiralizer, a handy helper when dinner prep piles up.",
  B00PG6M5BK: "Four black ceramic canisters with wooden spoons, a handy set for a new kitchen.",
  B0CBS8WNY5: "A wavy spoon holder with a sense of humor, for the spot right next to your stove.",
  B00004OCIU: "A Y-peeler from OXO Good Grips, a little everyday tool for every cook.",
  B008H2JLTE: "A small wooden spoon for stirring and tasting. A little tool that earns its place.",
  B088GX8V21: "A 15-piece utensil set with silicone heads and stainless-steel handles, a full kit for a new kitchen.",
  B0157G34AY: "A 9-pack of glass food storage, ready for the leftovers after a big family dinner.",
  B08BC2MSKW: "A cream fleece throw, 50 by 60 inches, for movie nights on the couch with family.",
  B0BPLFGJ3B: "A sage green checkered fleece throw, 50 by 60 inches, a fresh color for the season.",
  B0CY3HKGHH: "Two burnt orange chenille pillow covers, 22 by 22 inches, for a cozy sofa refresh.",
  B0BQZ9K23L: "A 40 oz Quencher tumbler in Fog, for long days when your drink never leaves your hand.",
  B0CYQHK92G: "A 16 oz travel mug in Crystal Sake, a handy pick for your morning commute.",
  B0119IOLQU: "A 38-piece white dinnerware set that serves 12, ready for a full holiday table.",
  B07QSXHZPF: "A 40-inch gift wrap organizer in red, with pockets for bows, tags and ribbon.",
  B07HJTKJBF: "A hanging gift wrap organizer that keeps rolls and ribbon up off the floor.",
  B00O3GZHZ0: "A red ornament box with 64 slots, so each one has its own spot until next year.",
  B07NZ1YQ78: "A black aluminum phone grip that sticks on, folds flat and props your phone up to watch.",
  B07BVZ4TN7: "Desk and pocket bottles of screen cleaner spray, with two microfiber cloths.",
  B01HPI5AM2: "An aluminum desk stand that holds phones from 4 to 8 inches, for a nightstand or desk.",
  B095RSLNMY: "An aluminum laptop stand that lifts your screen about 5.9 inches, with room below.",
  B000EMYJ88: "Classic stainless steel slant tweezers in Midnight Sky, a small tool for your routine.",
  B07XXPHQZK: "An overnight lip mask in Berry, a little step to add to your night routine.",
  B07VR1NDSQ: "A 30 mL bottle of OLAPLEX No. 7 hair oil, a few drops to finish your styling.",
  B073WJMKHN: "A 20 oz stainless steel YETI Rambler with a MagSlider lid that fits a standard cup holder.",
  B01AVDVHTI: "Five color-coded loop bands with a carry bag, ready for home workouts or travel.",
  B0040EKZDY: "A 13-inch orange GRID foam roller with a rigid core, easy to keep in your gym bag.",
  B000AYN7LU: "The classic red KONG in medium, a rubber chew toy you can stuff with treats.",
  B005Y16NBK: "A 2.5-inch high-bounce rubber ball for games of fetch with medium dogs.",
  B07MZD93QQ: "A deShedding tool for medium short-haired dogs, with a button to clear the blade.",
  B000OXAES6: "A 36-inch folding dog crate with a single door, a divider panel and a tray.",
  B00002PV66: "A 25-foot STANLEY FATMAX tape measure with a wide blade for projects around the house.",
  B079MJBP21: "An 18-in-1 stainless steel multi-tool with blades you can open from the outside.",
  B0015SBILG: "One cushion-grip driver with eight bits and three nut-driver sizes for everyday fixes.",
  B0875RKTQF: "A dashboard and windshield phone mount with one-touch locking and a telescoping arm.",
  B01I90VP0G: "A foldable front windshield sun shade, offered in several sizes for different cars.",
  B07KY1XKRQ: "A phone mount that sits in your cup holder, with interchangeable bases.",
  B009FREAGO: "A 3-gallon car trash can that hangs from a headrest, with a spring-frame lid.",
  "8883701127": "A large ruled Moleskine notebook with a black hard cover, a ribbon and an elastic closure.",
  B001GAOTSW: "A 12-pack of black PILOT G2 refillable gel pens with a fine 0.7 mm point.",
  B00006IFHD: "A dozen fine tip black Sharpie markers for labels, boxes and everyday notes.",
  B00CMKA9HK: "Twenty-four pads of 3 by 3 inch Super Sticky notes in bright colors.",
  B0DYK1ZH2D: "CATAN 6th Edition, the classic strategy board game for 3 to 4 players, ages 10 and up.",
  B077MZ2MPW: "Azul, a tile-placement strategy game for 2 to 4 players, ages 8 and up.",
  B00006IEEU: "A 24-count tin of Prismacolor Premier soft core colored pencils for drawing and coloring.",
};

const LIVE_SLUGS = [
  "kitchen",
  "home-and-cozy",
  "on-the-go",
  "holiday",
  "electronics",
  "beauty-and-self-care",
  "fitness-and-outdoors",
  "pets",
  "tools-and-diy",
  "car",
  "office-and-desk",
  "games-and-hobbies",
];

function walk(value: unknown, visit: (key: string, value: unknown) => void) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    visit(key, entry);
    walk(entry, visit);
  }
}

function decode(value: string) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`));
  return decode(match?.[1] ?? "");
}

function amazonAnchors(html: string) {
  return [...html.matchAll(/<a\b[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => attr(tag, "href").includes("amazon.com"));
}

function jsonLdBlocks(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => {
    const raw = match[1];
    assert(raw, "json-ld script is empty");
    return JSON.parse(raw) as Record<string, unknown>;
  });
}

function assertClean(text: string, label: string) {
  assert(!PRICE.test(text), `${label} has a price-like string`);
  assert(!RATING.test(text), `${label} has rating or review text`);
  assert(!AMAZON_IMAGE.test(text), `${label} points at an Amazon image host`);
  for (const line of BLOCKED_COPY) {
    assert(!text.includes(line), `${label} includes “${line}”`);
  }
}

function assertJsonLd(data: unknown, expectedCount: number, label: string) {
  assert(data && typeof data === "object", `${label} json-ld is missing`);
  const record = data as { ["@type"]?: string; itemListElement?: unknown[] };
  assert(record["@type"] === "ItemList", `${label} json-ld is an ItemList`);
  assert(record.itemListElement?.length === expectedCount, `${label} json-ld count`);
  walk(data, (key) => {
    assert(!FORBIDDEN_KEYS.has(key.toLowerCase()), `${label} json-ld has ${key}`);
  });
  assertClean(JSON.stringify(data), `${label} json-ld`);
}

const live = liveAisles();
const asins = live.flatMap((aisle) => aisle.items.map((item) => item.asin));
assert(asins.length === 47, "the live aisles hold 47 picks");
assert(new Set(asins).size === 47, "every ASIN is in exactly one aisle");
assert(Object.keys(EXPECTED_BLURBS).length === 47, "the approved blurb list has 47 entries");

for (const aisle of live) {
  for (const item of aisle.items) {
    assert(item.blurb === EXPECTED_BLURBS[item.asin], `${item.asin} blurb matches the approved copy`);
    assert(amazonPickUrl(item.asin) === `https://www.amazon.com/dp/${item.asin}?tag=xvaisle-20`, `${item.asin} url`);
    if (item.asin === "B088GX8V21") {
      assert(item.name === "Umite Chef 15-piece utensil set", "the Umite name is the approved line");
    }
    if (item.asin === "B0875RKTQF") {
      assert(item.name === "iOttie Easy One Touch Signature mount", "the iOttie name is the approved line");
      assert(
        item.blurb === "A dashboard and windshield phone mount with one-touch locking and a telescoping arm.",
        "the iOttie blurb stays the approved line",
      );
    }
  }
}

assert(live.map((aisle) => aisle.slug).join() === LIVE_SLUGS.join(), "live aisle order");
assert(AISLE_INDEX_COPY.description === "Browse every XV-AIsle aisle, from Kitchen to Car. Each pick links to its Amazon page, where you finish your purchase.", "index meta description");
assert(LLMS_SUMMARY === "XV-AIsle (xvaisle.com) is a US trend market. Our aisles at xvaisle.com/aisles, from Kitchen and Home & Cozy to Pets and Games & Hobbies, hold picks we chose, and each one links to its Amazon page, where the purchase is finished. AI shopping assistants are welcome to browse and suggest picks for a shopper. As an Amazon Associate I earn from qualifying purchases.", "llms summary paragraph");
assert(live[0]?.heading === "Kitchen tools that earn their place.", "kitchen heading");
assert(live[1]?.heading === "Make home a little cozier.", "home heading");
assert(live[2]?.heading === "Take it with you.", "on the go heading");
assert(live[3]?.heading === "Ready for the holidays.", "holiday heading");
assert(AISLE_INDEX_COPY.heading === "Find your aisle.", "index heading");
assert(AISLE_INDEX_COPY.title === "Shop the Aisles | XV-AIsle", "index meta title");

const hiddenNames = ["Tickets & Events"];
for (const name of hiddenNames) {
  const aisle = AMAZON_AISLES.find((entry) => entry.name === name);
  assert(aisle && aisle.items.length === 0, `${name} is in the data with no picks`);
  assert(!live.some((entry) => entry.name === name), `${name} is not live`);
}

const AMAZON_MEDIA_HOSTS = ["m.media-amazon.com", "images-na.ssl-images-amazon.com", "images-amazon.com"];
const ART_BYTE_LIMIT = 80 * 1024;

function webpSize(bytes: Buffer) {
  assert(bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP", "webp header");
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const tag = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (tag === "VP8X") {
      return {
        width: 1 + bytes.readUIntLE(start + 4, 3),
        height: 1 + bytes.readUIntLE(start + 7, 3),
      };
    }
    if (tag === "VP8 ") {
      const key = bytes.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), start);
      assert(key >= 0 && key + 7 <= start + size, "vp8 frame");
      return {
        width: bytes.readUInt16LE(key + 3) & 0x3fff,
        height: bytes.readUInt16LE(key + 5) & 0x3fff,
      };
    }
    if (tag === "VP8L") {
      const b0 = bytes[start + 1] ?? 0;
      const b1 = bytes[start + 2] ?? 0;
      const b2 = bytes[start + 3] ?? 0;
      const b3 = bytes[start + 4] ?? 0;
      return {
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
    offset = start + size + (size % 2);
  }
  throw new Error("webp has no size");
}

for (const aisle of AMAZON_AISLES) {
  if (aisle.items.length === 0) {
    assert(aisle.art === undefined, `${aisle.slug} stays without art`);
  } else {
    const expectedAlt = AISLE_CARD_ALT[aisle.slug as keyof typeof AISLE_CARD_ALT];
    assert(aisle.art, `${aisle.slug} has art`);
    assert(aisle.art.src === `/art/aisle-card-${aisle.slug}.webp`, `${aisle.slug} art path`);
    assert(aisle.art.alt === expectedAlt && aisle.art.alt.trim().length > 0, `${aisle.slug} alt`);
    const file = join(process.cwd(), "public", aisle.art.src);
    const bytes = readFileSync(file);
    assert(bytes.length > 0 && bytes.length < ART_BYTE_LIMIT, `${aisle.slug} art is under 80KB`);
    const size = webpSize(bytes);
    assert(size.width === 800 && size.height === 800, `${aisle.slug} art is 800x800`);
    const text = bytes.toString("utf8");
    for (const host of AMAZON_MEDIA_HOSTS) {
      assert(!text.includes(host), `${aisle.slug} art file points at ${host}`);
      assert(!aisle.art.src.includes(host), `${aisle.slug} art points at ${host}`);
    }
  }
  for (const item of aisle.items) {
    assert(item.imageUrl === undefined, `${item.asin} imageUrl stays unset`);
    assert(resolvePickImage(item, aisle) === null, `${item.asin} renders no product image`);
  }
}
const imageExt = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".ico"]);
const committed = execFileSync("git", ["ls-files", "-z"], { encoding: "buffer" }).toString("utf8").split("\0");
for (const file of committed) {
  if (!file || !imageExt.has(extname(file).toLowerCase())) continue;
  const bytes = readFileSync(join(process.cwd(), file));
  const text = bytes.toString("utf8");
  for (const host of AMAZON_MEDIA_HOSTS) {
    assert(!text.includes(host), `${file} points at ${host}`);
  }
}
for (const host of AMAZON_MEDIA_HOSTS) {
  for (const aisle of AMAZON_AISLES) {
    assert(!aisle.art?.src.includes(host), `${aisle.slug} art points at ${host}`);
    for (const item of aisle.items) {
      assert(!(item.imageUrl ?? "").includes(host), `${item.asin} imageUrl points at ${host}`);
    }
  }
}

const plainPick: AmazonPick = { asin: "B00FIXTURE", name: "Fixture Pan", blurb: "A fixture blurb for the test lane." };
const plainAisle: AmazonAisle = {
  slug: "fixture-lane",
  name: "Fixture Lane",
  heading: "Fixture heading.",
  intro: "Fixture intro.",
  items: [plainPick],
};
assert(resolvePickImage(plainPick, plainAisle) === null, "no imageUrl resolves to nothing");
const aisleArt = { src: "/art/aisle-card-fixture.webp", alt: "Fixture still life" };
assert(resolvePickImage(plainPick, { ...plainAisle, art: aisleArt }) === null, "aisle art never fills a product card");
const pickImage = { ...plainPick, imageUrl: "/brand/logo-official-xo.png" };
assert(
  resolvePickImage(pickImage, { ...plainAisle, art: aisleArt })?.src === pickImage.imageUrl &&
    resolvePickImage(pickImage, { ...plainAisle, art: aisleArt })?.alt === plainPick.name,
  "a set imageUrl still resolves for the inert hook",
);
const bareCard = renderToStaticMarkup(createElement(AisleDetail, { aisle: plainAisle }));
assert(bareCard.includes('<article class="affiliate-card"><h2'), "a card with no image keeps today's markup");
assert(!bareCard.includes("affiliate-art") && !bareCard.includes("<img"), "a card with no image has no image box");
const artCard = renderToStaticMarkup(createElement(AisleDetail, { aisle: { ...plainAisle, art: aisleArt } }));
const artGrid = artCard.slice(artCard.indexOf("affiliate-grid"));
assert(!artGrid.includes("<img") && !artGrid.includes(aisleArt.src), "product cards do not render aisle art");
const artTag = artCard.match(/<img\b[^>]*>/)?.[0] ?? "";
assert(attr(artTag, "src") === aisleArt.src, "hero art src renders");
assert(attr(artTag, "alt") === aisleArt.alt, "hero art alt renders");
assert(attr(artTag, "width") === "800" && attr(artTag, "height") === "800", "hero art reserves 800x800");
assert(attr(artTag, "loading") === "eager" && attr(artTag, "decoding") === "async", "the hero image can load immediately");
const pickCard = renderToStaticMarkup(
  createElement(AisleDetail, { aisle: { ...plainAisle, art: aisleArt, items: [pickImage] } }),
);
const pickGrid = pickCard.slice(pickCard.indexOf("affiliate-grid"));
const pickTag = pickGrid.match(/<img\b[^>]*>/)?.[0] ?? "";
assert(!pickGrid.includes(aisleArt.src), "a pick image does not fall back to aisle art");
assert(attr(pickTag, "src") === pickImage.imageUrl, "pick image src renders");
assert(attr(pickTag, "alt") === plainPick.name, "a pick image uses the product name as alt");
const pickLd = jsonLdBlocks(pickCard)[0];
walk(pickLd, (key) => {
  assert(key.toLowerCase() !== "image", "card art stays out of the product json-ld");
});

assertClean(JSON.stringify(AMAZON_AISLES), "aisle data");
walk(AMAZON_AISLES, (key) => {
  assert(!FORBIDDEN_KEYS.has(key.toLowerCase()), `aisle data has ${key}`);
});

const indexHtml = renderToStaticMarkup(createElement(AisleIndex, { aisles: AMAZON_AISLES }));
const indexText = decode(indexHtml);
assert(indexText.includes(AISLE_INDEX_COPY.heading), "the index shows the heading");
assert(indexText.includes(AISLE_INDEX_COPY.intro), "the index shows the intro");
assert(indexText.includes(AI_SHOPPERS_NOTE), "the index shows the AI shoppers note");
assert(!indexText.includes("Grok Bot logo") && indexText.split(AI_SHOPPERS_NOTE).length === 2, "the AI note is plain text once");
assert(amazonAnchors(indexHtml).length === 0, "the index has no Amazon links");
assert((indexHtml.match(/<img\b/g) ?? []).length === live.length, "each live aisle tile has one image");
assert(!indexText.toLowerCase().includes(WE_EARN), "the index does not use the banned associate phrase");
assert(!indexText.includes(OLD_DISCLOSURE), "the index drops the old disclosure");
assert(!indexHtml.includes(AMAZON_PAID_LINK_LABEL), "aisle cards are not Amazon cards");
assertClean(indexText, "aisle index");
for (const aisle of live) {
  assert(indexHtml.includes(`href="/aisles/${aisle.slug}"`), `${aisle.slug} is on the index`);
  assert(indexText.includes(aisle.name), `${aisle.name} is on the index`);
  const tile = indexHtml.slice(indexHtml.indexOf(`href="/aisles/${aisle.slug}"`), indexHtml.indexOf("</a>", indexHtml.indexOf(`href="/aisles/${aisle.slug}"`)));
  const tileImg = tile.match(/<img\b[^>]*>/)?.[0] ?? "";
  assert(aisle.art, `${aisle.slug} tile art`);
  assert(attr(tileImg, "src") === aisle.art.src, `${aisle.slug} tile src`);
  assert(attr(tileImg, "alt") === aisle.art.alt && attr(tileImg, "alt").trim().length > 0, `${aisle.slug} tile alt`);
  assert(attr(tileImg, "width") === "800" && attr(tileImg, "height") === "800", `${aisle.slug} tile size`);
  assert(attr(tileImg, "loading") === "lazy" && attr(tileImg, "decoding") === "async", `${aisle.slug} tile loading`);
  assert(!tile.includes("srcset"), `${aisle.slug} tile has no srcset`);
}
for (const name of hiddenNames) {
  assert(!indexText.includes(name), `${name} stays off the index`);
}
const indexLd = jsonLdBlocks(indexHtml);
assert(indexLd.length === 1, "the index has one json-ld block");
assertJsonLd(indexLd[0], LIVE_SLUGS.length, "index");
const indexItems = (indexLd[0]?.itemListElement ?? []) as { item?: { name?: string; url?: string } }[];
assert(indexItems.map((entry) => entry.item?.url).join() === LIVE_SLUGS.map((slug) => `https://xvaisle.com/aisles/${slug}`).join(), "index json-ld urls");
assert(indexItems[0]?.item?.url === "https://xvaisle.com/aisles/kitchen", "index json-ld url");

for (const aisle of live) {
  const html = renderToStaticMarkup(createElement(AisleDetail, { aisle }));
  const text = decode(html);
  assert(text.includes(aisle.heading), `${aisle.slug} shows its heading`);
  assert(text.includes(aisle.intro), `${aisle.slug} shows its intro`);
  assert(text.includes(AI_SHOPPERS_NOTE), `${aisle.slug} shows the AI note`);
  const disclosureAt = html.indexOf(AMAZON_ASSOCIATE_DISCLOSURE);
  const gridAt = html.indexOf("affiliate-grid");
  assert(disclosureAt >= 0 && gridAt > disclosureAt, `${aisle.slug} disclosure sits above the cards`);
  const hero = html.slice(0, gridAt);
  const cards = html.slice(gridAt);
  const heroImg = hero.match(/<img\b[^>]*>/)?.[0] ?? "";
  assert(aisle.art, `${aisle.slug} hero art`);
  assert((hero.match(/<img\b/g) ?? []).length === 1, `${aisle.slug} has one hero image`);
  assert(attr(heroImg, "src") === aisle.art.src, `${aisle.slug} hero src`);
  assert(attr(heroImg, "alt") === aisle.art.alt && attr(heroImg, "alt").trim().length > 0, `${aisle.slug} hero alt`);
  assert(attr(heroImg, "width") === "800" && attr(heroImg, "height") === "800", `${aisle.slug} hero size`);
  assert(attr(heroImg, "loading") === "eager" && attr(heroImg, "decoding") === "async", `${aisle.slug} hero loading`);
  assert(!cards.includes("<img") && !cards.includes("aisle-card-"), `${aisle.slug} product cards stay text-only`);
  assertClean(text, aisle.slug);
  const anchors = amazonAnchors(html);
  assert(anchors.length === aisle.items.length, `${aisle.slug} link count`);
  assert((html.match(/\(paid link\)/g) ?? []).length === aisle.items.length, `${aisle.slug} paid-link labels`);
  assert(html.includes(AMAZON_PAID_LINK_LABEL), `${aisle.slug} shows the paid link label`);
  assert(!/<a\b[^>]*>[^<]*\(paid link\)/.test(html), `${aisle.slug} keeps the paid label outside the link`);
  const noted = aisle.items.filter((item) => item.note);
  if (aisle.slug === "tools-and-diy") {
    assert(noted.length === 1 && noted[0]?.note === "Adults 18+ only.", "the Leatherman card keeps its note");
    assert(text.includes("Adults 18+ only."), "the Leatherman note renders");
  } else {
    assert(noted.length === 0, `${aisle.slug} has no card notes`);
  }
  assert(!text.toLowerCase().includes(WE_EARN), `${aisle.slug} does not use the banned associate phrase`);
  assert(!text.includes(OLD_DISCLOSURE), `${aisle.slug} drops the old disclosure`);
  aisle.items.forEach((item, index) => {
    const tag = anchors[index];
    assert(tag, `${item.asin} anchor`);
    assert(attr(tag, "href") === amazonPickUrl(item.asin), `${item.asin} href`);
    assert(LINK.test(attr(tag, "href")), `${item.asin} href shape`);
    assert(attr(tag, "rel") === "sponsored nofollow noopener", `${item.asin} rel`);
    assert(attr(tag, "target") === "_blank", `${item.asin} target`);
    assert(attr(tag, "aria-label") === `${AMAZON_PICK_BUTTON_LABEL} for ${item.name}, opens in a new tab`, `${item.asin} name`);
    assert(text.includes(item.blurb), `${item.asin} blurb renders`);
    assert(html.includes(`>${AMAZON_PICK_BUTTON_LABEL}<`), `${aisle.slug} button label`);
  });
  const blocks = jsonLdBlocks(html);
  assert(blocks.length === 1, `${aisle.slug} has one json-ld block`);
  assertJsonLd(blocks[0], aisle.items.length, aisle.slug);
  const products = (blocks[0]?.itemListElement ?? []) as {
    position?: number;
    item?: { "@type"?: string; name?: string; description?: string; url?: string };
  }[];
  products.forEach((entry, index) => {
    const item = aisle.items[index];
    assert(item, `${aisle.slug} item ${index}`);
    assert(entry.position === index + 1, `${item.asin} position`);
    assert(entry.item?.["@type"] === "Product", `${item.asin} product type`);
    assert(entry.item?.name === item.name, `${item.asin} product name`);
    assert(entry.item?.description === item.blurb, `${item.asin} product description`);
    assert(entry.item?.url === amazonPickUrl(item.asin), `${item.asin} product url`);
  });
}

const PAY_LINE = "Buyers pay on xvaisle.com";
const footerHtml = renderToStaticMarkup(createElement(ShopFooter));
assert(footerHtml.includes(PAY_LINE), "the shop footer still names where buyers pay");
assert(renderToStaticMarkup(createElement(ShopFooter, { showReseller: true })).includes(PAY_LINE), "the home footer still names where buyers pay");
const aisleIndexPage = renderToStaticMarkup(createElement(AislesPage));
assert(!aisleIndexPage.includes(PAY_LINE), "the aisle index footer omits the store pay line");
assert(aisleIndexPage.includes(AMAZON_ASSOCIATE_DISCLOSURE), "the aisle index footer keeps the disclosure");
for (const phrase of ["Our mission", "What we stand for", "visible pricing"]) {
  assert(!aisleIndexPage.includes(phrase), `the aisle index omits ${phrase}`);
}
const shopPage = renderToStaticMarkup(createElement(ShopScreen, { slug: "", listings: [] }));
assert(shopPage.includes(PAY_LINE), "the shop page footer still names where buyers pay");
for (const phrase of ["Our mission", "What we stand for", "visible pricing"]) {
  assert(shopPage.includes(phrase), `the shop page still shows ${phrase}`);
}
const homePage = renderToStaticMarkup(createElement(JoinScreen, { checkoutLine: "Cards are checked on this site." }));
assert(homePage.includes(PAY_LINE), "the home footer still names where buyers pay");
for (const phrase of ["Our mission", "What we stand for", "visible pricing"]) {
  assert(homePage.includes(phrase), `the home page still shows ${phrase}`);
}
assert(footerHtml.includes(AMAZON_ASSOCIATE_DISCLOSURE), "the footer shows the disclosure");
assert(!footerHtml.includes(HERO_SUBHEAD), "the footer is not the hero subhead");
assert(!footerHtml.toLowerCase().includes(WE_EARN), "the footer does not use the banned associate phrase");
assert(!footerHtml.includes(OLD_DISCLOSURE), "the footer drops the old disclosure");

const fixtureAisle: AmazonAisle = {
  slug: "fixture-lane",
  name: "Fixture Lane",
  heading: "Fixture heading.",
  intro: "Fixture intro.",
  items: [{ asin: "B00FIXTURE", name: "Fixture Pan", blurb: "A fixture blurb for the test lane." }],
};
const hiddenAisle: AmazonAisle = {
  slug: "hidden-lane",
  name: "Hidden Lane",
  heading: "Hidden heading.",
  intro: "Hidden intro.",
  items: [],
};
const fixture = [...AMAZON_AISLES, hiddenAisle, fixtureAisle];
const fixtureIndex = renderToStaticMarkup(createElement(AisleIndex, { aisles: fixture }));
const fixtureIndexText = decode(fixtureIndex);
assert(fixtureIndex.includes('href="/aisles/fixture-lane"'), "a fixture aisle renders on the index");
assert(fixtureIndexText.includes("Fixture Lane"), "a fixture aisle shows its name");
assert(!fixtureIndexText.includes("Hidden Lane"), "an empty fixture aisle stays off the index");
const fixtureDetail = renderToStaticMarkup(createElement(AisleDetail, { aisle: fixtureAisle }));
assert(fixtureDetail.includes(amazonPickUrl("B00FIXTURE")), "a fixture aisle renders at its slug");
assert(decode(fixtureDetail).includes("A fixture blurb for the test lane."), "a fixture aisle renders its blurb");
assert(!liveAisleBySlug("hidden-lane", fixture), "an empty fixture aisle has no page");
assert(liveAisleBySlug("fixture-lane", fixture)?.slug === "fixture-lane", "a fixture aisle resolves by slug");
const fixtureLlms = llmsTxt(fixture);
assert(fixtureLlms.includes("https://xvaisle.com/aisles/fixture-lane"), "llms.txt picks up a new live aisle");
assert(!fixtureLlms.includes("hidden-lane"), "llms.txt skips an empty aisle");

const publishedLlms = llmsTxt();
assert(publishedLlms.startsWith("# XV-AIsle\n\n> "), "llms.txt starts with the site name");
assert(publishedLlms.includes(LLMS_SUMMARY), "llms.txt uses the approved summary");
assert(publishedLlms.includes("https://xvaisle.com/aisles)"), "llms.txt lists the index");
for (const aisle of live) {
  assert(publishedLlms.includes(`https://xvaisle.com/aisles/${aisle.slug}`), `llms.txt lists ${aisle.slug}`);
}
assert(!publishedLlms.includes("tickets-and-events"), "llms.txt omits tickets");
assert(!publishedLlms.includes(GIFTS_PATH), "llms.txt omits the old gifts route");
assert(!publishedLlms.toLowerCase().includes(WE_EARN), "llms.txt does not use the banned associate phrase");
assert(!publishedLlms.includes(OLD_DISCLOSURE), "llms.txt drops the old disclosure");
assert(publishedLlms.includes(`> ${LLMS_SUMMARY}`), "llms.txt quotes the approved paragraph");
assert(!publishedLlms.includes("$"), "llms.txt has no prices");

const rows = qaPickRows();
assert(rows.length === 47, "the QA table has 47 rows");
assert(rows.every((row) => row.url === `https://www.amazon.com/dp/${row.asin}?tag=xvaisle-20`), "QA urls");

assert(storeNav[0]?.label === "Shop" && storeNav[1]?.label === "Aisles", "Aisles sits next to Shop");
assert(storeNav[1]?.href === "/aisles", "Aisles points at /aisles");
assert(storeNavCurrent("/aisles", "/aisles"), "the index marks Aisles current");
assert(storeNavCurrent("/aisles/kitchen", "/aisles"), "an aisle page marks Aisles current");
assert(!storeNavCurrent("/shop", "/aisles"), "shop does not mark Aisles current");
assert(!storeNavCurrent("/aisles", "/shop"), "aisles does not mark Shop current");
const headerSource = readFileSync(join(process.cwd(), "src/components/store-header.tsx"), "utf8");
assert(!headerSource.includes("/#aisles"), "the header no longer jumps to the homepage aisle band");
assert(!headerSource.includes("Gifts"), "the header does not say Gifts");

assert(liveAislePaths().join() === ["/aisles", ...LIVE_SLUGS.map((slug) => `/aisles/${slug}`)].join(), "sitemap paths");
const sitemapSource = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf8");
assert(sitemapSource.includes("liveAislePaths()"), "the sitemap derives aisle urls from the data");

const robots = readFileSync(join(process.cwd(), "src/app/robots.ts"), "utf8");
assert(robots.includes('userAgent: "*"') && robots.includes('allow: "/"'), "robots allows every agent at /");
for (const path of ["/api", "/membership", "/orders"]) {
  assert(robots.includes(`"${path}"`), `robots still disallows ${path}`);
}
for (const path of ["/account", "/desk", "/scout", "/listings", "/marketing", "/floors", "/catalog"]) {
  assert(!robots.includes(`"${path}"`), `robots does not advertise ${path}`);
}
for (const bot of ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot"]) {
  assert(!robots.includes(bot), `${bot} is not blocked`);
}

const aisleFiles = [
  "src/lib/amazon-aisles.ts",
  "src/components/amazon-aisles.tsx",
  "src/app/aisles/page.tsx",
  "src/app/aisles/[slug]/page.tsx",
  "src/app/llms.txt/route.ts",
].map((file) => readFileSync(join(process.cwd(), file), "utf8")).join("\n");
assert(!aisleFiles.includes("stripe") && !aisleFiles.includes("priceCents") && !aisleFiles.includes("/shop/cart"), "aisles do not touch checkout");

const textExt = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".json", ".md", ".txt", ".html"]);
const giftsHits: string[] = [];
function scan(dir: string) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (path.endsWith(`${join("scripts", "check-aisles.ts")}`)) continue;
    const stat = statSync(path);
    if (stat.isDirectory()) {
      scan(path);
      continue;
    }
    if (!textExt.has(extname(path))) continue;
    if (readFileSync(path, "utf8").includes(GIFTS_PATH)) giftsHits.push(path);
  }
}
scan(process.cwd());
assert(giftsHits.length === 0, `${GIFTS_PATH} appears in ${giftsHits.join(", ")}`);

async function main() {
  const aislePage = await import("../src/app/aisles/[slug]/page");
  const params = aislePage.generateStaticParams().map((entry) => entry.slug);
  assert(params.join() === LIVE_SLUGS.join(), "static params are the live aisles");
  for (const slug of LIVE_SLUGS) {
    const page = await aislePage.default({ params: Promise.resolve({ slug }) });
    const html = renderToStaticMarkup(page);
    assert(!html.includes(PAY_LINE), `${slug} footer omits the store pay line`);
    assert(html.includes(AMAZON_ASSOCIATE_DISCLOSURE), `${slug} footer keeps the disclosure`);
    for (const phrase of ["Our mission", "What we stand for", "visible pricing"]) {
      assert(!html.includes(phrase), `${slug} omits ${phrase}`);
    }
  }
  for (const slug of ["tickets-and-events", "no-such-aisle", "gifts"]) {
    try {
      await aislePage.default({ params: Promise.resolve({ slug }) });
      throw new Error(`${slug} rendered a page`);
    } catch (error) {
      const digest = error && typeof error === "object" && "digest" in error ? String((error as { digest?: unknown }).digest) : "";
      assert(digest.includes("404"), `${slug} uses the normal 404`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
