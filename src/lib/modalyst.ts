export type ImportedProduct = {
  id: string;
  sku: string;
  title: string;
  description: string;
  images: string[];
  wholesaleCostCents: number;
  listPriceCents: number;
  shipsFrom: string;
  shipDaysMin: number;
  shipDaysMax: number;
};

export type SkippedProduct = { id: string; reason: string };

export type ModalystEnv = {
  MODALYST_API_BASE?: string;
  MODALYST_API_KEY?: string;
  MODALYST_API_SECRET?: string;
};

export type ModalystConfig = { base: string; key: string; secret: string | null };

const SLUG = /^[a-z0-9-]{1,60}$/;
const SKU = /^[A-Za-z0-9-]{1,40}$/;
const CURSOR = /^[A-Za-z0-9_-]{1,80}$/;
const PAGE_LIMIT = 5;

export function modalystConfig(env: ModalystEnv): ModalystConfig | { error: string } {
  const baseRaw = env.MODALYST_API_BASE?.trim() ?? "";
  const key = env.MODALYST_API_KEY?.trim() ?? "";
  const secretRaw = env.MODALYST_API_SECRET?.trim() ?? "";
  if (!baseRaw || !key) return { error: "Set MODALYST_API_BASE and MODALYST_API_KEY." };
  let url: URL;
  try {
    url = new URL(baseRaw);
  } catch {
    return { error: "MODALYST_API_BASE is not a URL." };
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    return { error: "MODALYST_API_BASE must be an https origin with no credentials." };
  }
  if (url.pathname !== "/" && url.pathname !== "") return { error: "MODALYST_API_BASE is the origin only." };
  return { base: url.origin, key, secret: secretRaw || null };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown, max: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return SLUG.test(slug) ? slug : "";
}

function dollarCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    const cents = Math.round(value * 100);
    if (Math.abs(value * 100 - cents) > 0.001) return null;
    return cents <= 10_000_000 ? cents : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= 10_000_000 ? cents : null;
}

function integerCents(value: unknown) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 10_000_000) return null;
  return value;
}

function money(record: Record<string, unknown>, centsKeys: string[], dollarKeys: string[]) {
  for (const key of centsKeys) {
    if (record[key] == null || record[key] === "") continue;
    return integerCents(record[key]);
  }
  for (const key of dollarKeys) {
    if (record[key] == null || record[key] === "") continue;
    return dollarCents(record[key]);
  }
  return null;
}

function httpsImage(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 300) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function imagesOf(record: Record<string, unknown>) {
  const found: string[] = [];
  const push = (value: unknown) => {
    if (found.length >= 8) return;
    const recordValue = asRecord(value);
    const candidate = recordValue ? (recordValue.src ?? recordValue.url) : value;
    const image = httpsImage(candidate);
    if (image && !found.includes(image)) found.push(image);
  };
  if (Array.isArray(record.images)) {
    for (const image of record.images) push(image);
  }
  push(record.image);
  return found;
}

function shipDays(record: Record<string, unknown>) {
  const min = record.ship_days_min;
  const max = record.ship_days_max;
  if (typeof min === "number" || typeof max === "number") {
    if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
    if ((min as number) < 0 || (max as number) > 365 || (min as number) > (max as number)) return null;
    return { min: min as number, max: max as number };
  }
  const raw = text(record.ship_days, 20) ?? text(record.processing_time, 20);
  if (!raw) return null;
  const match = /^(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?$/.exec(raw);
  if (!match) return null;
  const lo = Number(match[1]);
  const hi = match[2] ? Number(match[2]) : lo;
  if (lo > 365 || hi > 365 || lo > hi) return null;
  return { min: lo, max: hi };
}

function productRows(body: unknown) {
  const record = asRecord(body);
  if (!record) return null;
  if (Array.isArray(record.products)) return record.products;
  const data = asRecord(record.data);
  if (data && Array.isArray(data.products)) return data.products;
  return null;
}

export function mapModalystPayload(body: unknown): { products: ImportedProduct[]; skipped: SkippedProduct[] } | { error: string } {
  const rows = productRows(body);
  if (!rows) return { error: "Modalyst did not return a product list." };
  const products: ImportedProduct[] = [];
  const skipped: SkippedProduct[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const record = asRecord(row);
    const rawId = record ? (text(record.id, 80) ?? text(record.sku, 80) ?? "") : "";
    const id = slugify(rawId);
    if (!record || !id) {
      skipped.push({ id: "row", reason: "invalid id" });
      continue;
    }
    if (seen.has(id)) {
      skipped.push({ id, reason: "duplicate id" });
      continue;
    }
    seen.add(id);
    const title = text(record.title, 180);
    if (!title) {
      skipped.push({ id, reason: "invalid title" });
      continue;
    }
    const wholesaleCostCents = money(record, ["wholesale_cost_cents", "cost_cents"], ["wholesale_cost", "cost", "wholesale"]);
    const listPriceCents = money(record, ["list_price_cents", "price_cents"], ["list_price", "price", "retail"]);
    if (wholesaleCostCents == null || listPriceCents == null || listPriceCents < 50) {
      skipped.push({ id, reason: "invalid price" });
      continue;
    }
    const shipsFrom = text(record.ships_from, 120) ?? text(record.ship_from, 120) ?? text(record.origin, 120);
    if (!shipsFrom) {
      skipped.push({ id, reason: "missing ship-from" });
      continue;
    }
    const days = shipDays(record);
    if (!days) {
      skipped.push({ id, reason: "missing ship days" });
      continue;
    }
    const skuSource = text(record.sku, 40);
    const sku = skuSource && SKU.test(skuSource) ? skuSource : id.slice(0, 40).toUpperCase();
    const description = typeof record.description === "string" ? record.description.trim().slice(0, 4000) : "";
    products.push({
      id,
      sku,
      title,
      description,
      images: imagesOf(record),
      wholesaleCostCents,
      listPriceCents,
      shipsFrom,
      shipDaysMin: days.min,
      shipDaysMax: days.max,
    });
  }
  return { products, skipped };
}

export function nextCursor(body: unknown) {
  const record = asRecord(body);
  const cursor = record ? record.next_cursor : null;
  return typeof cursor === "string" && CURSOR.test(cursor) ? cursor : null;
}

export async function fetchModalystProducts(
  config: ModalystConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ products: ImportedProduct[]; skipped: SkippedProduct[] } | { error: string }> {
  const products: ImportedProduct[] = [];
  const skipped: SkippedProduct[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const url = new URL("/v1/products", config.base);
    if (cursor) url.searchParams.set("cursor", cursor);
    if (url.origin !== config.base) return { error: "Modalyst product URL left the configured origin." };
    const headers: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${config.key}`,
    };
    if (config.secret) headers["X-Modalyst-Api-Secret"] = config.secret;
    let response: Response;
    try {
      response = await fetchImpl(url, { headers });
    } catch {
      return { error: "Modalyst could not be reached." };
    }
    if (!response.ok) return { error: "Modalyst refused the product request." };
    const body: unknown = await response.json().catch(() => null);
    const mapped = mapModalystPayload(body);
    if ("error" in mapped) return mapped;
    products.push(...mapped.products);
    skipped.push(...mapped.skipped);
    const next = nextCursor(body);
    if (!next || next === cursor) break;
    cursor = next;
  }
  return { products, skipped };
}
