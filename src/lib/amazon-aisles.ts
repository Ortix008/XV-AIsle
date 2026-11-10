/**
 * Amazon Associates aisles. This file is the only place that lists aisles and picks.
 * An aisle with an empty `items` list stays off the index, has no page, and is left
 * out of the sitemap, JSON-LD, and /llms.txt. Add a future aisle by appending one object.
 */

export const AMAZON_ASSOCIATE_TAG = "xvaisle-20";

export const AMAZON_ASSOCIATE_DISCLOSURE = "As an Amazon Associate I earn from qualifying purchases.";

export const AMAZON_PICK_BUTTON_LABEL = "See price on Amazon";

export const AMAZON_PAID_LINK_LABEL = "(paid link)";

export const AI_SHOPPERS_NOTE =
  "AI shopping assistants like Grok Bot are welcome here to browse the aisles and help you choose.";

export const AMAZON_SITE_ORIGIN = "https://xvaisle.com";

export const LLMS_SUMMARY =
  "XV-AIsle (xvaisle.com) is a US trend market. Our aisles at xvaisle.com/aisles, from Kitchen and Home & Cozy to Pets and Games & Hobbies, hold picks we chose, and each one links to its Amazon page, where the purchase is finished. AI shopping assistants are welcome to browse and suggest picks for a shopper. As an Amazon Associate I earn from qualifying purchases.";

export const AISLE_INDEX_COPY = {
  heading: "Find your aisle.",
  title: "Shop the Aisles | XV-AIsle",
  description:
    "Browse every XV-AIsle aisle, from Kitchen to Car. Each pick links to its Amazon page, where you finish your purchase.",
  intro: "Every aisle holds picks we chose for real homes and everyday life. Tap an aisle to see what's inside.",
} as const;

export type AmazonPick = {
  asin: string;
  name: string;
  blurb: string;
  note?: string;
  /**
   * Optional card image. Leave this unset until art is approved.
   * A live Amazon PA-API URL or a CJ/Rakuten feed URL may be hotlinked here later, only after approval.
   * Never download, copy, or commit a product image into this repo.
   */
  imageUrl?: string;
};

export type AisleArt = {
  src: string;
  alt: string;
};

export type AmazonAisle = {
  slug: string;
  name: string;
  heading: string;
  intro: string;
  items: readonly AmazonPick[];
  /** Optional aisle art used when a pick has no imageUrl. Leave unset until the designer delivers it. */
  art?: AisleArt;
};

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function pick(asin: string, name: string, blurb: string, note?: string): AmazonPick {
  return note ? { asin, name, blurb, note } : { asin, name, blurb };
}

export const AMAZON_AISLES: readonly AmazonAisle[] = [
  {
    slug: "kitchen",
    name: "Kitchen",
    heading: "Kitchen tools that earn their place.",
    intro: "Cast iron, handy prep tools and storage for the meals your family makes every day.",
    items: [
      pick(
        "B00006JSUA",
        'Lodge Pre-Seasoned Cast Iron Skillet, 10.25"',
        "A 10.25-inch cast iron skillet, pre-seasoned and ready for the first family breakfast.",
      ),
      pick(
        "B000N501BK",
        "Lodge Essential Enamel Cast Iron Dutch Oven, 6 Quart (Island Spice Red)",
        "A 6-quart enameled cast iron Dutch oven in Island Spice Red, made for slow Sunday stews.",
      ),
      pick(
        "B00004S7V8",
        "Microplane Classic Zester Grater, Black",
        "A classic zester and grater, a little tool for anyone who loves to cook.",
      ),
      pick(
        "B0764HS4SL",
        "Fullstar Pro Original Vegetable Chopper & Spiralizer (4-in-1, White)",
        "A 4-in-1 vegetable chopper and spiralizer, a handy helper when dinner prep piles up.",
      ),
      pick(
        "B00PG6M5BK",
        "Home Basics 4-Piece Ceramic Canister Set with Wooden Spoons, Black",
        "Four black ceramic canisters with wooden spoons, a handy set for a new kitchen.",
      ),
      pick(
        "B0CBS8WNY5",
        "OTOTO Funny Spoon Holder (Wavy)",
        "A wavy spoon holder with a sense of humor, for the spot right next to your stove.",
      ),
      pick(
        "B00004OCIU",
        "OXO Good Grips Y-Peeler, Black",
        "A Y-peeler from OXO Good Grips, a little everyday tool for every cook.",
      ),
      pick(
        "B008H2JLTE",
        "OXO Good Grips Small Wooden Spoon",
        "A small wooden spoon for stirring and tasting. A little tool that earns its place.",
      ),
      pick(
        "B088GX8V21",
        "Umite Chef 15-Piece Silicone Kitchen Utensil Set (Khaki)",
        "A 15-piece silicone utensil set in khaki, a full kit for a new home or a holiday host.",
      ),
      pick(
        "B0157G34AY",
        "Pyrex Simply Store 9-Pack Mixed Glass Food Storage Set",
        "A 9-pack of glass food storage, ready for the leftovers after a big family dinner.",
      ),
    ],
  },
  {
    slug: "home-and-cozy",
    name: "Home & Cozy",
    heading: "Make home a little cozier.",
    intro: "Soft throws and pillow covers for movie nights and slow weekends.",
    items: [
      pick(
        "B08BC2MSKW",
        'Bedsure GentleSoft Fleece Throw Blanket, Cream, 50x60"',
        "A cream fleece throw, 50 by 60 inches, for movie nights on the couch with family.",
      ),
      pick(
        "B0BPLFGJ3B",
        'Bedsure Checkered Fleece Throw, Sage Green, 50x60"',
        "A sage green checkered fleece throw, 50 by 60 inches, a fresh color for the season.",
      ),
      pick(
        "B0CY3HKGHH",
        "Foindtower Chenille Throw Pillow Covers, Burnt Orange, 22x22 (Pack of 2)",
        "Two burnt orange chenille pillow covers, 22 by 22 inches, for a cozy sofa refresh.",
      ),
    ],
  },
  {
    slug: "on-the-go",
    name: "On the Go",
    heading: "Take it with you.",
    intro: "Tumblers and travel mugs for the commute, the car and the long day ahead.",
    items: [
      pick(
        "B0BQZ9K23L",
        "STANLEY Quencher H2.0 FlowState Tumbler, 40 oz, Fog",
        "A 40 oz Quencher tumbler in Fog, for long days when your drink never leaves your hand.",
      ),
      pick(
        "B0CYQHK92G",
        "Contigo Autoseal West Loop Travel Mug, Crystal Sake, 16 oz",
        "A 16 oz travel mug in Crystal Sake, a handy pick for your morning commute.",
      ),
    ],
  },
  {
    slug: "holiday",
    name: "Holiday",
    heading: "Ready for the holidays.",
    intro: "Dinnerware for a full table, plus organizers for gift wrap and ornaments.",
    items: [
      pick(
        "B0119IOLQU",
        "Corelle Vitrelle 38-Piece Service for 12, Winter Frost White",
        "A 38-piece white dinnerware set that serves 12, ready for a full holiday table.",
      ),
      pick(
        "B07QSXHZPF",
        'ZOBER Gift Wrapping Paper Organizer Storage, 40" (Red)',
        "A 40-inch gift wrap organizer in red, with pockets for bows, tags and ribbon.",
      ),
      pick(
        "B07HJTKJBF",
        'Freegrace Hanging Gift Wrap Organizer, 41" (White)',
        "A hanging gift wrap organizer that keeps rolls and ribbon up off the floor.",
      ),
      pick(
        "B00O3GZHZ0",
        'Elf Stor Christmas Ornament Storage Box, Red, 12x12x12" (64 compartments)',
        "A red ornament box with 64 slots, so each one has its own spot until next year.",
      ),
    ],
  },
  {
    slug: "electronics",
    name: "Electronics",
    heading: "Everyday tech, picked with care.",
    intro: "Handy tech for home, work and everything in between.",
    items: [
      pick(
        "B07NZ1YQ78",
        "PopSockets Adhesive Phone Grip, Aluminum Black",
        "A black aluminum phone grip that sticks on, folds flat and props your phone up to watch.",
      ),
      pick(
        "B07BVZ4TN7",
        "WHOOSH! Screen Shine Duo, 3.4 + 0.3 fl oz",
        "Desk and pocket bottles of screen cleaner spray, with two microfiber cloths.",
      ),
      pick(
        "B01HPI5AM2",
        "Lamicall Cell Phone Stand, Desk Dock, Black",
        "An aluminum desk stand that holds phones from 4 to 8 inches, for a nightstand or desk.",
      ),
      pick(
        "B095RSLNMY",
        "Rain Design mStand Laptop Stand, Black",
        "An aluminum laptop stand that lifts your screen about 5.9 inches, with room below.",
      ),
    ],
  },
  {
    slug: "beauty-and-self-care",
    name: "Beauty & Self-Care",
    heading: "Take a little time for you.",
    intro: "Everyday care picks for your routine.",
    items: [
      pick(
        "B000EMYJ88",
        "Tweezerman Slant Tweezer, Midnight Sky",
        "Classic stainless steel slant tweezers in Midnight Sky, a small tool for your routine.",
      ),
      pick(
        "B07XXPHQZK",
        "LANEIGE Lip Sleeping Mask, Berry",
        "An overnight lip mask in Berry, a little step to add to your night routine.",
      ),
      pick(
        "B07VR1NDSQ",
        "OLAPLEX N°.7 Bonding Hair Oil, 30 mL",
        "A 30 mL bottle of OLAPLEX No. 7 hair oil, a few drops to finish your styling.",
      ),
    ],
  },
  {
    slug: "fitness-and-outdoors",
    name: "Fitness & Outdoors",
    heading: "Get out and move.",
    intro: "Gear for workouts, walks and weekends outside.",
    items: [
      pick(
        "B073WJMKHN",
        "YETI Rambler 20 oz Tumbler with MagSlider Lid, Black",
        "A 20 oz stainless steel YETI Rambler with a MagSlider lid that fits a standard cup holder.",
      ),
      pick(
        "B01AVDVHTI",
        "Fit Simplify Resistance Loop Exercise Bands, Set of 5",
        "Five color-coded loop bands with a carry bag, ready for home workouts or travel.",
      ),
      pick(
        "B0040EKZDY",
        "TRIGGERPOINT GRID Foam Roller, Original 13-inch, Orange",
        "A 13-inch orange GRID foam roller with a rigid core, easy to keep in your gym bag.",
      ),
    ],
  },
  {
    slug: "pets",
    name: "Pets",
    heading: "For the pets in the family.",
    intro: "Everyday picks for the furry members of the family.",
    items: [
      pick(
        "B000AYN7LU",
        "KONG Classic Stuffable Dog Toy, Medium, Red",
        "The classic red KONG in medium, a rubber chew toy you can stuff with treats.",
      ),
      pick(
        "B005Y16NBK",
        "Chuckit! Ultra Ball, Medium 2.5-inch, 1-Pack",
        "A 2.5-inch high-bounce rubber ball for games of fetch with medium dogs.",
      ),
      pick(
        "B07MZD93QQ",
        "FURminator Undercoat deShedding Tool, Medium Dog, Short Hair",
        "A deShedding tool for medium short-haired dogs, with a button to clear the blade.",
      ),
      pick(
        "B000OXAES6",
        "MidWest Homes for Pets iCrate, 36-Inch Single Door",
        "A 36-inch folding dog crate with a single door, a divider panel and a tray.",
      ),
    ],
  },
  {
    slug: "tools-and-diy",
    name: "Tools & DIY",
    heading: "Fix it, build it, make it yours.",
    intro: "Handy tools for projects around the house.",
    items: [
      pick(
        "B00002PV66",
        "STANLEY FATMAX Tape Measure, 25-Foot (33-725)",
        "A 25-foot STANLEY FATMAX tape measure with a wide blade for projects around the house.",
      ),
      pick(
        "B079MJBP21",
        "LEATHERMAN Wave Plus 18-in-1 Multi-Tool, Stainless Steel",
        "An 18-in-1 stainless steel multi-tool with blades you can open from the outside.",
        "Adults 18+ only.",
      ),
      pick(
        "B0015SBILG",
        "Klein Tools 32500 11-in-1 Screwdriver / Nut Driver",
        "One cushion-grip driver with eight bits and three nut-driver sizes for everyday fixes.",
      ),
    ],
  },
  {
    slug: "car",
    name: "Car",
    heading: "Ready for the drive.",
    intro: "Handy picks for your car and the road ahead.",
    items: [
      pick(
        "B0875RKTQF",
        "iOttie Easy One Touch 5 Dashboard & Windshield Mount",
        "A dashboard and windshield phone mount with one-touch locking and a telescoping arm.",
      ),
      pick(
        "B01I90VP0G",
        "EcoNour Foldable Windshield Sun Shade",
        "A foldable front windshield sun shade, offered in several sizes for different cars.",
      ),
      pick(
        "B07KY1XKRQ",
        "WeatherTech CupFone, Universal Cup Holder Phone Mount, Black",
        "A phone mount that sits in your cup holder, with interchangeable bases.",
      ),
      pick(
        "B009FREAGO",
        "High Road TrashStash Hanging Car Trash Can, Black, 3 Gallon",
        "A 3-gallon car trash can that hangs from a headrest, with a spring-frame lid.",
      ),
    ],
  },
  {
    slug: "office-and-desk",
    name: "Office & Desk",
    heading: "A desk that works for you.",
    intro: "Picks for a tidy desk and a smoother workday.",
    items: [
      pick(
        "8883701127",
        "Moleskine Classic Notebook, Large, Ruled, Black Hard Cover (5 x 8.25)",
        "A large ruled Moleskine notebook with a black hard cover, a ribbon and an elastic closure.",
      ),
      pick(
        "B001GAOTSW",
        "PILOT G2 Premium Gel Pens, Fine 0.7mm, Black, 12-Pack",
        "A 12-pack of black PILOT G2 refillable gel pens with a fine 0.7 mm point.",
      ),
      pick(
        "B00006IFHD",
        "Sharpie Permanent Markers, Fine Tip, Black, 12 Count",
        "A dozen fine tip black Sharpie markers for labels, boxes and everyday notes.",
      ),
      pick(
        "B00CMKA9HK",
        "Post-it Super Sticky Notes, 3 x 3 in, 24 Pads (Energy Boost / Neon Fizz)",
        "Twenty-four pads of 3 by 3 inch Super Sticky notes in bright colors.",
      ),
    ],
  },
  {
    slug: "games-and-hobbies",
    name: "Games & Hobbies",
    heading: "Time for some fun.",
    intro: "Games and hobby picks for family nights and free afternoons.",
    items: [
      pick(
        "B0DYK1ZH2D",
        "CATAN Board Game (6th Edition)",
        "CATAN 6th Edition, the classic strategy board game for 3 to 4 players, ages 10 and up.",
      ),
      pick(
        "B077MZ2MPW",
        "Azul Mosaic Tile-Placement Strategy Board Game",
        "Azul, a tile-placement strategy game for 2 to 4 players, ages 8 and up.",
      ),
      pick(
        "B00006IEEU",
        "Prismacolor Premier Soft Core Colored Pencils, 24 Count",
        "A 24-count tin of Prismacolor Premier soft core colored pencils for drawing and coloring.",
      ),
    ],
  },
  {
    slug: "tickets-and-events",
    name: "Tickets & Events",
    heading: "Something to look forward to.",
    intro: "Tickets and events for nights out with family and friends.",
    items: [],
  },
];

/** Pick image, then aisle art, then nothing. An empty string counts as unset. */
export function resolvePickImage(item: AmazonPick, aisle: AmazonAisle) {
  const pickSrc = item.imageUrl?.trim();
  if (pickSrc) return { src: pickSrc, alt: item.name };
  const aisleSrc = aisle.art?.src.trim();
  if (aisleSrc) return { src: aisleSrc, alt: aisle.art?.alt ?? "" };
  return null;
}

export function amazonPickUrl(asin: string) {
  if (!ASIN_PATTERN.test(asin)) {
    throw new Error("Amazon ASIN must be 10 letters or digits.");
  }
  return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_ASSOCIATE_TAG}`;
}

export function aisleUrl(slug: string) {
  return `${AMAZON_SITE_ORIGIN}/aisles/${slug}`;
}

/** Aisles that have at least one pick. Empty aisles stay unpublished. */
export function liveAisles(aisles: readonly AmazonAisle[] = AMAZON_AISLES) {
  return aisles.filter((aisle) => aisle.items.length > 0);
}

export function liveAisleBySlug(slug: string, aisles: readonly AmazonAisle[] = AMAZON_AISLES) {
  return liveAisles(aisles).find((aisle) => aisle.slug === slug);
}

export function liveAislePaths(aisles: readonly AmazonAisle[] = AMAZON_AISLES) {
  return ["/aisles", ...liveAisles(aisles).map((aisle) => `/aisles/${aisle.slug}`)];
}

export function pickLinkLabel(name: string) {
  return `${AMAZON_PICK_BUTTON_LABEL} for ${name}, opens in a new tab`;
}

export type QaPickRow = {
  aisle: string;
  name: string;
  asin: string;
  url: string;
};

export function qaPickRows(aisles: readonly AmazonAisle[] = AMAZON_AISLES): QaPickRow[] {
  return liveAisles(aisles).flatMap((aisle) =>
    aisle.items.map((item) => ({
      aisle: aisle.name,
      name: item.name,
      asin: item.asin,
      url: amazonPickUrl(item.asin),
    })),
  );
}

export function aisleIndexJsonLd(aisles: readonly AmazonAisle[] = AMAZON_AISLES) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: AISLE_INDEX_COPY.heading,
    itemListElement: liveAisles(aisles).map((aisle, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        name: aisle.name,
        url: aisleUrl(aisle.slug),
      },
    })),
  };
}

export function aisleProductJsonLd(aisle: AmazonAisle) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: aisle.name,
    itemListElement: aisle.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Product",
        name: item.name,
        description: item.blurb,
        url: amazonPickUrl(item.asin),
      },
    })),
  };
}

export function llmsTxt(aisles: readonly AmazonAisle[] = AMAZON_AISLES) {
  const lines = [
    "# XV-AIsle",
    "",
    `> ${LLMS_SUMMARY}`,
    "",
    `- [${AISLE_INDEX_COPY.heading}](${AMAZON_SITE_ORIGIN}/aisles): ${AISLE_INDEX_COPY.intro}`,
  ];
  for (const aisle of liveAisles(aisles)) {
    const detail = aisle.intro ? `: ${aisle.intro}` : "";
    lines.push(`- [${aisle.heading}](${aisleUrl(aisle.slug)})${detail}`);
  }
  return `${lines.join("\n")}\n`;
}

function validateAisles(aisles: readonly AmazonAisle[]) {
  const asins = new Set<string>();
  const slugs = new Set<string>();
  for (const aisle of aisles) {
    if (!SLUG_PATTERN.test(aisle.slug)) {
      throw new Error(`Aisle slug is not kebab-case: ${aisle.slug}`);
    }
    if (slugs.has(aisle.slug)) throw new Error(`Duplicate aisle slug: ${aisle.slug}`);
    slugs.add(aisle.slug);
    for (const item of aisle.items) {
      if (!ASIN_PATTERN.test(item.asin)) throw new Error(`Bad ASIN: ${item.asin}`);
      if (asins.has(item.asin)) throw new Error(`ASIN is in more than one aisle: ${item.asin}`);
      asins.add(item.asin);
    }
  }
}

validateAisles(AMAZON_AISLES);
