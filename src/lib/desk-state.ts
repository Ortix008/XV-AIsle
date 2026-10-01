import { findProduct } from "./catalog";
import type {
  BotId,
  Campaign,
  DeskState,
  Listing,
  LogLine,
  Order,
  PipelineItem,
  Post,
  PriceId,
  Reply,
} from "./types";

const BOTS: BotId[] = ["scout", "listings", "orders", "marketing"];
const PRICE_IDS: PriceId[] = ["floor", "target", "stretch"];
const ORDER_STATUSES: Order["status"][] = ["processing", "in_transit", "delayed", "delivered", "quality"];
const POST_CHANNELS: Post["channel"][] = ["X", "TikTok", "Instagram", "Meta"];

export function deskStorageKey(accountId: string) {
  return `xv-desk:v4:${accountId}`;
}

export function emptyDesk(today: string): DeskState {
  return {
    version: 4,
    startedOn: today,
    bots: {
      scout: { running: false },
      listings: { running: false },
      orders: { running: false },
      marketing: { running: false },
    },
    pipeline: [],
    queue: [],
    listings: [],
    orders: [],
    campaigns: [],
    log: [],
    recheck: 0,
    selected: {
      scout: null,
      listing: null,
      order: null,
      marketing: null,
    },
    gettingStartedHidden: false,
  };
}

export function purgeOldDesks(storage: Storage) {
  const stale: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) continue;
    if (key === "aisle-desk-v2" || key === "xvaisle-desk-legacy-owner" || key.startsWith("xvaisle-desk-v3:")) {
      stale.push(key);
    }
  }
  for (const key of stale) storage.removeItem(key);
}

export function clipText(value: string, max: number) {
  return value.length > max ? value.slice(0, max) : value;
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? clipText(value, max) : "";
}

function cleanPipeline(value: unknown): PipelineItem | null {
  if (!value || typeof value !== "object") return null;
  const row = value as PipelineItem;
  if (typeof row.productId !== "string" || !findProduct(row.productId)) return null;
  if (row.status !== "review" && row.status !== "approved" && row.status !== "passed") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.discoveredOn)) return null;
  const picked =
    row.pickedSupplierId == null
      ? null
      : typeof row.pickedSupplierId === "string"
        ? clipText(row.pickedSupplierId, 80)
        : null;
  return {
    productId: row.productId,
    status: row.status,
    discoveredOn: row.discoveredOn,
    pickedSupplierId: picked,
  };
}

function cleanPrices(value: unknown): Listing["prices"] | null {
  if (!Array.isArray(value)) return null;
  const prices: Listing["prices"] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const price = item as Listing["prices"][number];
    if (!PRICE_IDS.includes(price.id)) return null;
    if (typeof price.label !== "string" || typeof price.retail !== "number" || !Number.isFinite(price.retail)) {
      return null;
    }
    if (typeof price.margin !== "number" || !Number.isFinite(price.margin) || typeof price.capped !== "boolean") {
      return null;
    }
    prices.push({
      id: price.id,
      label: clipText(price.label, 40),
      retail: price.retail,
      margin: price.margin,
      capped: price.capped,
      note: clip(price.note, 240),
    });
  }
  return prices.length === 3 ? prices : null;
}

function cleanListing(value: unknown): Listing | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Listing;
  if (typeof row.productId !== "string" || !findProduct(row.productId)) return null;
  if (typeof row.supplierId !== "string") return null;
  if (!Array.isArray(row.titles) || row.titles.length !== 3 || row.titles.some((title) => typeof title !== "string")) {
    return null;
  }
  const prices = cleanPrices(row.prices);
  if (!prices) return null;
  const priceId = PRICE_IDS.includes(row.priceId) ? row.priceId : "target";
  return {
    productId: row.productId,
    supplierId: clipText(row.supplierId, 80),
    titles: [clip(row.titles[0], 180), clip(row.titles[1], 180), clip(row.titles[2], 180)],
    titleIndex: row.titleIndex === 1 || row.titleIndex === 2 ? row.titleIndex : 0,
    description: clip(row.description, 8000),
    bullets: Array.isArray(row.bullets)
      ? row.bullets.filter((item): item is string => typeof item === "string").slice(0, 12).map((item) => clipText(item, 400))
      : [],
    tags: Array.isArray(row.tags)
      ? row.tags.filter((item): item is string => typeof item === "string").slice(0, 13).map((item) => clipText(item, 40))
      : [],
    prices,
    priceId,
    status: row.status === "ready" ? "ready" : "draft",
  };
}

function cleanReply(value: unknown): Reply | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Reply;
  if (typeof row.subject !== "string" || typeof row.body !== "string") return null;
  return {
    subject: clipText(row.subject, 180),
    body: clipText(row.body, 8000),
    status: row.status === "approved" ? "approved" : "draft",
  };
}

function cleanOrder(value: unknown): Order | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Order;
  if (typeof row.id !== "string" || typeof row.number !== "string") return null;
  if (typeof row.customer !== "string" || typeof row.productName !== "string") return null;
  if (typeof row.qty !== "number" || typeof row.merchandise !== "number" || typeof row.shippingPaid !== "number") {
    return null;
  }
  if (!ORDER_STATUSES.includes(row.status)) return null;
  const dates = [row.placedOn, row.eta, row.needBy];
  if (dates.some((date) => typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) return null;
  const email = typeof row.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? row.email : "";
  const flag = row.flag === "delay" || row.flag === "quality" ? row.flag : null;
  return {
    id: clipText(row.id, 80),
    number: clipText(row.number, 40),
    customer: clipText(row.customer, 80),
    email: clipText(email, 254),
    productId: clip(row.productId, 80),
    productName: clipText(row.productName, 160),
    qty: row.qty,
    merchandise: row.merchandise,
    shippingPaid: row.shippingPaid,
    placedOn: row.placedOn,
    carrier: clip(row.carrier, 40),
    tracking: clip(row.tracking, 80),
    eta: row.eta,
    needBy: row.needBy,
    status: row.status,
    flag,
    issue: typeof row.issue === "string" ? clipText(row.issue, 500) : null,
    reply: cleanReply(row.reply),
  };
}

function cleanPost(value: unknown): Post | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Post;
  if (typeof row.id !== "string" || !POST_CHANNELS.includes(row.channel)) return null;
  if (typeof row.label !== "string" || typeof row.headline !== "string" || typeof row.body !== "string") return null;
  return {
    id: clipText(row.id, 80),
    channel: row.channel,
    label: clipText(row.label, 80),
    headline: clipText(row.headline, 180),
    body: clipText(row.body, 4000),
    status: row.status === "approved" ? "approved" : "draft",
  };
}

function cleanCampaign(value: unknown): Campaign | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Campaign;
  if (typeof row.productId !== "string" || !findProduct(row.productId) || !Array.isArray(row.posts)) return null;
  const posts = row.posts.map(cleanPost).filter((post): post is Post => post != null).slice(0, 8);
  if (posts.length === 0) return null;
  return { productId: row.productId, posts };
}

function cleanLog(value: unknown): LogLine | null {
  if (!value || typeof value !== "object") return null;
  const row = value as LogLine;
  if (typeof row.id !== "string" || typeof row.text !== "string" || typeof row.at !== "number") return null;
  if (!BOTS.includes(row.bot) || !Number.isFinite(row.at)) return null;
  return { id: clipText(row.id, 80), at: row.at, bot: row.bot, text: clipText(row.text, 500) };
}

export function sanitizeDesk(input: unknown, today: string): DeskState | null {
  if (!input || typeof input !== "object") return null;
  const row = input as Partial<DeskState>;
  if (row.version !== 4 || !Array.isArray(row.pipeline)) return null;

  const seen = new Set<string>();
  const pipeline: PipelineItem[] = [];
  for (const item of row.pipeline) {
    const clean = cleanPipeline(item);
    if (!clean || seen.has(clean.productId)) continue;
    seen.add(clean.productId);
    pipeline.push(clean);
    if (pipeline.length >= 400) break;
  }

  const queued = new Set<string>();
  const queue: string[] = [];
  if (Array.isArray(row.queue)) {
    for (const id of row.queue) {
      if (typeof id !== "string" || seen.has(id) || queued.has(id) || !findProduct(id)) continue;
      queued.add(id);
      queue.push(id);
      if (queue.length >= 400) break;
    }
  }

  const bots = {} as DeskState["bots"];
  for (const id of BOTS) {
    const running = row.bots?.[id]?.running === true;
    bots[id] = { running };
  }

  const selected = {
    scout: null,
    listing: null,
    order: null,
    marketing: null,
  } as DeskState["selected"];
  if (row.selected && typeof row.selected === "object") {
    for (const key of Object.keys(selected) as (keyof DeskState["selected"])[]) {
      const value = row.selected[key];
      selected[key] = typeof value === "string" ? clipText(value, 80) : null;
    }
  }

  return {
    version: 4,
    startedOn: typeof row.startedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.startedOn) ? row.startedOn : today,
    gettingStartedHidden: row.gettingStartedHidden === true,
    bots,
    pipeline,
    queue,
    listings: Array.isArray(row.listings)
      ? row.listings.map(cleanListing).filter((item): item is Listing => item != null).slice(0, 200)
      : [],
    orders: Array.isArray(row.orders)
      ? row.orders.map(cleanOrder).filter((item): item is Order => item != null).slice(0, 200)
      : [],
    campaigns: Array.isArray(row.campaigns)
      ? row.campaigns.map(cleanCampaign).filter((item): item is Campaign => item != null).slice(0, 200)
      : [],
    log: Array.isArray(row.log)
      ? row.log.map(cleanLog).filter((item): item is LogLine => item != null).slice(0, 40)
      : [],
    recheck: typeof row.recheck === "number" && Number.isFinite(row.recheck) ? Math.max(0, Math.floor(row.recheck)) : 0,
    selected,
  };
}
