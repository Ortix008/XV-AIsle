import { getProduct } from "./catalog";
import { addDays, prettyDate, todayISO } from "./dates";
import {
  AD_RATE,
  FEE_FIXED,
  FEE_RATE,
  TARGET_MARGIN,
  charm,
  landedCost,
  money,
  netMargin,
  pct,
  round2,
  suggestRetail,
} from "./money";
import type {
  BotId,
  Campaign,
  DeskState,
  Listing,
  Order,
  PipelineItem,
  Post,
  PriceId,
  Product,
  Reply,
  SupplierQuote,
} from "./types";

export type QuoteRow = {
  supplier: SupplierQuote;
  landed: number;
  list: number;
  unconstrained: number;
  capped: boolean;
  margin: number;
  arrives: string;
  fits: boolean;
};

export type Assessment = {
  rows: QuoteRow[];
  chosen: QuoteRow;
  reason: string;
  needBy: string | null;
  pros: string[];
  cons: string[];
};

const RATING_FLOOR = 4.6;
const MARGIN_FLOOR = 0.25;

export function speedLabel(speed: SupplierQuote["speed"]) {
  if (speed === "pod") return "Print on demand";
  if (speed === "us") return "US stock";
  return "Overseas";
}

function laneTag(lane: Product["lane"]) {
  if (lane === "party-extra") return "party extra";
  if (lane === "kitchen") return "kitchen";
  return lane;
}

export function laneLabel(lane: Product["lane"]) {
  if (lane === "party-extra") return "Party extra";
  if (lane === "kitchen") return "Kitchen";
  if (lane === "apparel") return "Clothes";
  if (lane === "sport") return "Sports";
  if (lane === "utility") return "Utility";
  return "Food";
}

function listFor(landed: number, ceiling: number, target = TARGET_MARGIN) {
  const unconstrained = charm(suggestRetail(landed, target));
  const capped = unconstrained > ceiling + 0.001;
  const list = capped ? ceiling : unconstrained;
  return { unconstrained, capped, list, margin: netMargin(list, landed) };
}

export function assess(
  product: Product,
  today: string,
  pickedSupplierId?: string | null,
): Assessment {
  const needBy =
    product.neededInDays != null ? addDays(today, product.neededInDays) : null;

  const rows: QuoteRow[] = product.suppliers.map((supplier) => {
    const landed = landedCost(supplier);
    const priced = listFor(landed, product.ceiling);
    const arrives = addDays(today, supplier.shipDaysMax);
    const fits = needBy ? arrives <= needBy : true;
    return { supplier, landed, arrives, fits, ...priced };
  });

  let chosen: QuoteRow;
  let reason: string;

  if (pickedSupplierId) {
    chosen = rows.find((row) => row.supplier.id === pickedSupplierId) ?? rows[0];
    reason = "You picked a different supplier. The numbers below are for that one.";
  } else {
    const onTime = rows.filter((row) => row.fits);
    const dated = onTime.length > 0;
    const fastOnTime = onTime.filter((row) => row.supplier.speed !== "import");
    let pool = fastOnTime.length ? fastOnTime : dated ? onTime : rows;
    const usedFast = fastOnTime.length > 0;
    const rated = pool.filter((row) => row.supplier.rating >= RATING_FLOOR);
    if (rated.length) pool = rated;
    const healthy = pool.filter((row) => row.margin >= MARGIN_FLOOR && !row.capped);
    if (healthy.length) pool = healthy;
    pool = [...pool].sort(
      (a, b) =>
        a.list - b.list ||
        a.supplier.shipDaysMax - b.supplier.shipDaysMax ||
        b.supplier.rating - a.supplier.rating,
    );
    chosen = pool[0];

    if (chosen.supplier.speed === "import") {
      reason = needBy
        ? `Nothing from the US arrives by ${prettyDate(needBy)}. This one comes by boat in two to three weeks. Skip it unless the date can wait.`
        : "Nothing from a US warehouse or a print shop is a good buy. This one comes from overseas. Skip it.";
    } else if (!dated) {
      reason = needBy
        ? `Nothing arrives by ${prettyDate(needBy)}. This is the fastest option, and it is still late.`
        : "No date on this one. Picked the lowest price that still ships fast.";
    } else if (chosen.capped || chosen.margin < MARGIN_FLOOR) {
      reason = `Even the fast option keeps less than ${pct(MARGIN_FLOOR)} if the price stays under ${money(product.ceiling)}. A cheaper overseas option is listed and was not picked.`;
    } else if (chosen.supplier.speed === "pod") {
      reason = `Printed in ${chosen.supplier.origin} after someone orders it. Nothing sits on a boat. Lowest price among the fast options${
        needBy ? ` that arrive by ${prettyDate(needBy)}` : ""
      }.`;
    } else {
      reason = usedFast
        ? `Already in a US warehouse. Lowest price among the fast options${
            needBy ? ` that arrive by ${prettyDate(needBy)}` : ""
          }. Overseas options stay on the list and are not the pick.`
        : `Lowest price among suppliers rated ${RATING_FLOOR} or better.`;
    }
  }

  return {
    rows,
    chosen,
    reason,
    needBy,
    pros: prosFor(product, chosen, rows, needBy),
    cons: consFor(product, chosen, rows, needBy),
  };
}

function prosFor(
  product: Product,
  chosen: QuoteRow,
  rows: QuoteRow[],
  needBy: string | null,
) {
  const pros: string[] = [];
  const { supplier } = chosen;
  if (!chosen.capped && chosen.margin >= TARGET_MARGIN - 0.02) {
    const room = round2(product.ceiling - chosen.list);
    pros.push(
      room >= 4
        ? `Shelf of ${money(chosen.list)} sits ${money(room)} under the ${money(product.ceiling)} comp ceiling, so a small sale still clears.`
        : `Shelf of ${money(chosen.list)} holds about ${pct(chosen.margin)} net after fees and a 12% ad allowance.`,
    );
  }
  if (supplier.rating >= RATING_FLOOR) {
    pros.push(
      `${supplier.name} is ${supplier.rating} across ${supplier.reviews} orders in the book. MOQ is ${supplier.moq}.`,
    );
  }
  if (needBy && chosen.fits) {
    pros.push(
      `Arrives by ${prettyDate(chosen.arrives)}, inside the ${prettyDate(needBy)} need-by.`,
    );
  }
  if (supplier.speed === "pod") {
    pros.push(
      `Prints in ${supplier.origin} after the order. Nothing sits on a boat, and you are not holding blanks.`,
    );
  } else if (supplier.speed === "us" && supplier.shipDaysMax <= 7) {
    pros.push(
      `US stock in ${supplier.origin}. A reorder is ${supplier.shipDaysMin}–${supplier.shipDaysMax} days, which is what a social post can promise.`,
    );
  }
  pros.push(`Sits with ${product.complements}.`);
  return pros.slice(0, 4);
}

function consFor(
  product: Product,
  chosen: QuoteRow,
  rows: QuoteRow[],
  needBy: string | null,
) {
  const cons: string[] = [];
  const { supplier } = chosen;
  if (chosen.capped || chosen.margin < MARGIN_FLOOR) {
    cons.push(
      `At the ${money(product.ceiling)} ceiling, net margin is ${pct(chosen.margin)}. Pass unless inbound shipping drops.`,
    );
  }
  if (supplier.speed === "import" || supplier.shipDaysMin >= 10) {
    cons.push(
      `${supplier.shipDaysMin}–${supplier.shipDaysMax} days from ${supplier.origin}. That is a boat. Do not post it as ready this week.`,
    );
  }
  const ignoredImport = rows.find(
    (row) => row.supplier.speed === "import" && row.supplier.id !== supplier.id && row.landed + 0.5 < chosen.landed,
  );
  if (ignoredImport && supplier.speed !== "import") {
    cons.push(
      `${ignoredImport.supplier.name} is cheaper landed and takes ${ignoredImport.supplier.shipDaysMin}–${ignoredImport.supplier.shipDaysMax} days. Left off the pick.`,
    );
  }
  if (supplier.returnWindowDays <= 15) {
    cons.push(
      `Returns close in ${supplier.returnWindowDays} days. Photograph defects the day a carton lands.`,
    );
  }
  const faster = rows
    .filter((row) => row.supplier.id !== supplier.id && row.fits && row.supplier.shipDaysMax + 5 < supplier.shipDaysMin)
    .sort((a, b) => a.supplier.shipDaysMax - b.supplier.shipDaysMax)[0];
  if (faster) {
    cons.push(
      `${faster.supplier.name} arrives ${prettyDate(faster.arrives)} if you can list at ${money(faster.list)}.`,
    );
  }
  const missed = rows.filter((row) => needBy && !row.fits);
  if (missed.length && chosen.fits) {
    cons.push(
      `${missed.map((row) => row.supplier.name).join(" and ")} ${missed.length === 1 ? "misses" : "miss"} the ${prettyDate(needBy!)} date.`,
    );
  }
  if (needBy && !chosen.fits) {
    cons.push(`This quote arrives ${prettyDate(chosen.arrives)}, after the ${prettyDate(needBy)} need-by.`);
  }
  if (supplier.rating < RATING_FLOOR) {
    cons.push(`Rating is ${supplier.rating}. Order one sample before any ad spend.`);
  }
  return cons.slice(0, 4);
}

function priceMenu(landed: number, ceiling: number): Listing["prices"] {
  const specs: { id: PriceId; label: string; target: number; note: string }[] = [
    {
      id: "floor",
      label: "Sale",
      target: 0.28,
      note: "A sale price that still clears ads.",
    },
    {
      id: "target",
      label: "Target",
      target: TARGET_MARGIN,
      note: "Default list. This is the price to publish.",
    },
    {
      id: "stretch",
      label: "Stretch",
      target: 0.48,
      note: "Only if the photos look like a gift, not a supply.",
    },
  ];
  return specs.map((spec) => {
    const priced = listFor(landed, ceiling, spec.target);
    return {
      id: spec.id,
      label: spec.label,
      retail: round2(priced.list),
      margin: priced.margin,
      capped: priced.capped,
      note: priced.capped ? `${spec.note} Comp ceiling caps this one.` : spec.note,
    };
  });
}

export function buildListing(
  product: Product,
  today: string,
  pickedSupplierId?: string | null,
): Listing {
  const view = assess(product, today, pickedSupplierId);
  const { supplier } = view.chosen;
  const prices = priceMenu(view.chosen.landed, product.ceiling);
  const target = prices.find((price) => price.id === "target") ?? prices[1];
  const titles: [string, string, string] = [
    `${product.titleLead} for ${product.occasion}`,
    `${product.colorway} ${product.material.toLowerCase()} ${product.category.toLowerCase()}, ${product.size.toLowerCase()}`,
    `${product.titleLead} — ${supplier.shipDaysMin}–${supplier.shipDaysMax} day shipping`,
  ];
  const description = [
    `${product.titleLead} for ${product.occasion}. ${product.useLine}`,
    "",
    product.colorNote,
    "",
    `In the box: ${product.box}`,
    "",
    `${product.material}. ${product.size}.`,
    "",
    supplier.speed === "pod"
      ? `Printed in ${supplier.origin} by ${supplier.name} after checkout. Plan on ${supplier.shipDaysMin}–${supplier.shipDaysMax} days. Nothing ships from overseas.`
      : supplier.speed === "us"
        ? `Ships from ${supplier.origin} through ${supplier.name}. Plan on ${supplier.shipDaysMin}–${supplier.shipDaysMax} days.`
        : `Ships from ${supplier.origin} through ${supplier.name}. Plan on ${supplier.shipDaysMin}–${supplier.shipDaysMax} days. This is an import, not a week-of order.`,
  ].join("\n");
  const bullets = [
    product.box,
    `${product.material}, ${product.size.toLowerCase()}, ${product.colorway.toLowerCase()}.`,
    product.useLine,
    `Allow ${supplier.shipDaysMin}–${supplier.shipDaysMax} days from ${supplier.origin}.`,
    `Looks right next to ${product.complements}.`,
  ];
  const tags = Array.from(
    new Set(
      [
        ...product.keywords,
        product.category.toLowerCase(),
        product.colorway.toLowerCase(),
        laneTag(product.lane),
        product.occasion.replace(/^a /, ""),
      ].map((tag) => tag.toLowerCase()),
    ),
  ).slice(0, 13);

  return {
    productId: product.id,
    supplierId: supplier.id,
    titles,
    titleIndex: 0,
    description,
    bullets,
    tags,
    prices,
    priceId: target.id,
    status: "draft",
  };
}

export function listingText(listing: Listing, product: Product) {
  const price = listing.prices.find((item) => item.id === listing.priceId);
  return [
    listing.titles[listing.titleIndex] ?? listing.titles[0],
    price ? `Price: ${money(price.retail)}` : "",
    "",
    listing.description,
    "",
    "Bullets:",
    ...listing.bullets.map((bullet) => `- ${bullet}`),
    "",
    `Tags: ${listing.tags.join(", ")}`,
    "",
    `SKU: ${product.sku}`,
  ].join("\n");
}

function firstName(customer: string) {
  return customer.split(" ")[0] ?? customer;
}

export function draftDelayReply(order: Order): Reply {
  const total = round2(order.merchandise + order.shippingPaid);
  return {
    subject: `Order ${order.number} is late`,
    status: "draft",
    body: [
      `Hi ${firstName(order.customer)},`,
      "",
      `Your ${order.productName} (order ${order.number}) missed the delivery window of ${prettyDate(order.eta)}. ${order.carrier} tracking ${order.tracking} does not show a delivery scan. The need-by date on the order is ${prettyDate(order.needBy)}.`,
      "",
      "Reply with one number and I will do it today:",
      `1. Leave the order open. I check the scan again tomorrow and write you either way.`,
      `2. I refund the shipping you paid (${money(order.shippingPaid)}) now. You still receive the order when it arrives.`,
      `3. I cancel and refund the full ${money(total)} if the need-by date cannot move.`,
      "",
      "Sorry this slipped.",
      "",
      "Aisle support",
    ].join("\n"),
  };
}

export function draftQualityReply(order: Order): Reply {
  const total = round2(order.merchandise + order.shippingPaid);
  const issue = order.issue ?? "The item arrived with a problem.";
  return {
    subject: `Replacing order ${order.number}`,
    status: "draft",
    body: [
      `Hi ${firstName(order.customer)},`,
      "",
      `${issue} That is on us. You should not have to argue for a fix.`,
      "",
      "If you have a photo, reply with it. Then choose:",
      "1. I send a replacement and you keep or discard the damaged one. No return shipment.",
      `2. I refund the full ${money(total)} to the original payment method.`,
      "",
      `Order ${order.number}, ${order.productName}, qty ${order.qty}.`,
      "",
      "Aisle support",
    ].join("\n"),
  };
}

export function buildCampaign(product: Product, listing: Listing): Campaign {
  const price = listing.prices.find((item) => item.id === listing.priceId);
  const retail = price?.retail ?? listing.prices[0]?.retail ?? 0;
  const supplier = product.suppliers.find((item) => item.id === listing.supplierId);
  const window = supplier
    ? `${supplier.shipDaysMin}–${supplier.shipDaysMax} days`
    : "the window on the listing";
  const origin = supplier?.origin ?? "the supplier";
  const posts: Post[] = [
    {
      id: `${product.id}:x`,
      channel: "X",
      label: "Traffic post",
      headline: product.hook,
      status: "draft",
      body: [
        `${product.useLine} ${product.colorNote}`,
        "",
        `${money(retail)}. In the box: ${product.box} Ships in ${window} from ${origin}.`,
        "",
        "Share your shop link anywhere. Buyers pay on the store. Paste the listing link under this. Do not promise a faster ship window than the quote.",
      ].join("\n"),
    },
    {
      id: `${product.id}:tiktok`,
      channel: "TikTok",
      label: "15-second clip",
      headline: product.hook,
      status: "draft",
      body: [
        `Say this first: “${product.hook}”`,
        `On screen: ${product.titleLead}`,
        `Shot: ${product.mockups[0]?.direction ?? product.useLine}`,
        "",
        `Caption: ${product.trend.title}. ${product.useLine} ${money(retail)}. Ships in ${window}, so put the ship window in the listing and do not promise the weekend.`,
      ].join("\n"),
    },
    {
      id: `${product.id}:instagram`,
      channel: "Instagram",
      label: "Feed caption",
      headline: product.trend.title,
      status: "draft",
      body: [
        product.hook,
        "",
        `${product.useLine} ${product.colorNote}`,
        "",
        `${product.box}`,
        `${money(retail)} · ${window} from ${origin}.`,
        "",
        product.keywords
          .slice(0, 5)
          .map((keyword) => `#${keyword.replace(/[^a-z0-9]+/gi, "")}`)
          .join(" "),
      ].join("\n"),
    },
    {
      id: `${product.id}:meta`,
      channel: "Meta",
      label: "Checkout ad",
      headline: product.titleLead,
      status: "draft",
      body: [
        `Primary text: ${product.searchPhrase}. ${product.useLine} ${money(retail)}. Ships in ${window} from ${origin}.`,
        "",
        `Headline: ${product.hook}`,
        `Description: ${product.size}. ${product.material}.`,
        "",
        "Run this at people who already visited the store.",
      ].join("\n"),
    },
  ];
  return { productId: product.id, posts };
}

function logLine(bot: BotId, text: string): DeskState["log"][number] {
  return {
    id: `${bot}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    bot,
    text,
  };
}

function withLog(state: DeskState, bot: BotId, text: string): DeskState {
  return { ...state, log: [logLine(bot, text), ...state.log].slice(0, 40) };
}

export function applyPass(state: DeskState, bot: BotId, today = todayISO()): DeskState {
  if (bot === "scout") return scoutPass(state, today);
  if (bot === "listings") return listingPass(state, today);
  if (bot === "orders") return orderPass(state, today);
  return marketingPass(state);
}

function scoutPass(state: DeskState, today: string): DeskState {
  const nextId = state.queue[0];
  if (nextId) {
    const product = getProduct(nextId);
    const view = assess(product, today, null);
    const item: PipelineItem = {
      productId: product.id,
      status: "review",
      discoveredOn: today,
      pickedSupplierId: null,
    };
    return withLog(
      {
        ...state,
        queue: state.queue.slice(1),
        pipeline: [item, ...state.pipeline],
      },
      "scout",
      `Filed ${product.titleLead}. ${speedLabel(view.chosen.supplier.speed)} via ${view.chosen.supplier.name} at ${money(view.chosen.list)}, ${pct(view.chosen.margin)} net.`,
    );
  }

  const review = state.pipeline.filter((item) => item.status === "review");
  if (review.length === 0) {
    return withLog(state, "scout", "Trend file is caught up. Nothing is waiting in review.");
  }
  const index = state.recheck % review.length;
  const item = review[index];
  const product = getProduct(item.productId);
  const view = assess(product, today, item.pickedSupplierId);
  return withLog(
    { ...state, recheck: state.recheck + 1 },
    "scout",
    `Rechecked ${product.titleLead}. ${view.chosen.supplier.name} still leads at ${pct(view.chosen.margin)} net.`,
  );
}

function listingPass(state: DeskState, today: string): DeskState {
  const waitingList = state.pipeline.filter(
    (item) =>
      item.status === "approved" &&
      !state.listings.some((listing) => listing.productId === item.productId),
  );
  const waiting =
    waitingList.find((item) => item.productId === state.selected.listing) ??
    waitingList[0];
  if (!waiting) {
    return withLog(
      state,
      "listings",
      "No approved product is waiting on a listing.",
    );
  }
  const product = getProduct(waiting.productId);
  const listing = buildListing(product, today, waiting.pickedSupplierId);
  return withLog(
    { ...state, listings: [listing, ...state.listings] },
    "listings",
    `Drafted a listing for ${product.titleLead}. Target price ${money(listing.prices.find((price) => price.id === "target")?.retail ?? 0)}.`,
  );
}

function orderPass(state: DeskState, today: string): DeskState {
  const late = state.orders.find(
    (order) =>
      order.flag == null &&
      order.status !== "delivered" &&
      order.status !== "quality" &&
      order.eta < today,
  );
  if (late) {
    const orders = state.orders.map((order) =>
      order.id === late.id
        ? {
            ...order,
            status: "delayed" as const,
            flag: "delay" as const,
            issue: `Carrier scan missed the ${prettyDate(order.eta)} window.`,
            reply: draftDelayReply(order),
          }
        : order,
    );
    return withLog(
      { ...state, orders },
      "orders",
      `Flagged ${late.number} as late. Drafted a reply for ${late.customer}.`,
    );
  }

  const unwritten = state.orders.find((order) => order.flag && !order.reply);
  if (unwritten) {
    const reply =
      unwritten.flag === "quality"
        ? draftQualityReply(unwritten)
        : draftDelayReply(unwritten);
    const orders = state.orders.map((order) =>
      order.id === unwritten.id ? { ...order, reply } : order,
    );
    return withLog(
      { ...state, orders },
      "orders",
      `Drafted a ${unwritten.flag} reply for ${unwritten.number}.`,
    );
  }

  const open = state.orders.find((order) => order.status !== "delivered");
  if (!open) {
    return withLog(state, "orders", "Every open order is delivered. Nothing to watch.");
  }
  if (open.flag) {
    const waiting = open.reply?.status === "approved" ? "The reply is approved." : "The reply is waiting on you.";
    const kind = open.flag === "quality" ? "a quality issue" : "late";
    return withLog(state, "orders", `Checked ${open.number}. Still ${kind}. ${waiting}`);
  }
  return withLog(
    state,
    "orders",
    `Checked ${open.number}. ${open.carrier} still matches an ETA of ${prettyDate(open.eta)}.`,
  );
}

function marketingPass(state: DeskState): DeskState {
  const readyList = state.listings.filter(
    (listing) =>
      listing.status === "ready" &&
      !state.campaigns.some((campaign) => campaign.productId === listing.productId),
  );
  const ready =
    readyList.find((listing) => listing.productId === state.selected.marketing) ??
    readyList[0];
  if (!ready) {
    return withLog(
      state,
      "marketing",
      "Every ready listing already has posts. Mark another listing ready to continue.",
    );
  }
  const product = getProduct(ready.productId);
  const campaign = buildCampaign(product, ready);
  return withLog(
    { ...state, campaigns: [campaign, ...state.campaigns] },
    "marketing",
    `Wrote the social posts and a checkout ad for ${product.titleLead}.`,
  );
}

export function assumptionLine() {
  return `Net margin holds back ${pct(FEE_RATE)} + ${money(FEE_FIXED)} card fees and ${pct(AD_RATE)} of the shelf price for ads.`;
}
