import { rememberProduct } from "./catalog";
import { addedProduct } from "./stock";
import type { Lane, Product } from "./types";

const KEY = "xvaisle-added-articles-v1";
const OFFSET_KEY = "xvaisle-floor-offsets-v1";
const CLAIM_KEY = "xvaisle-added-legacy-owner";

function scopedKey(accountId: string) {
  return `${KEY}:${accountId}`;
}

export type SavedArticle = {
  id: string;
  aisle: string;
  section: string;
  name: string;
  lane: Lane;
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function claimLegacyArticles(accountId: string) {
  const key = scopedKey(accountId);
  if (window.localStorage.getItem(key)) return;
  const owner = window.localStorage.getItem(CLAIM_KEY);
  if (owner && owner !== accountId) return;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return;
  window.localStorage.setItem(key, raw);
  window.localStorage.setItem(CLAIM_KEY, accountId);
  window.localStorage.removeItem(KEY);
}

export function readAddedArticles(accountId?: string): SavedArticle[] {
  if (accountId) claimLegacyArticles(accountId);
  const rows = readJson<SavedArticle[]>(accountId ? scopedKey(accountId) : KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function writeAddedArticles(rows: SavedArticle[], accountId?: string) {
  window.localStorage.setItem(accountId ? scopedKey(accountId) : KEY, JSON.stringify(rows));
}

const lanes = new Set(["kitchen", "apparel", "sport", "utility", "food", "party-extra"]);

export function hydrateAddedProducts(accountId?: string) {
  for (const row of readAddedArticles(accountId)) {
    if (!row || typeof row.id !== "string" || typeof row.name !== "string" || typeof row.section !== "string") {
      continue;
    }
    if (!lanes.has(row.lane) || row.id.length > 80 || row.name.length > 120) continue;
    rememberProduct(
      addedProduct({
        id: row.id,
        name: row.name,
        category: row.section.slice(0, 80),
        lane: row.lane,
      }),
    );
  }
}

export function productFromArticle(row: SavedArticle): Product {
  return addedProduct({
    id: row.id,
    name: row.name,
    category: row.section,
    lane: row.lane,
  });
}

function offsetKey(accountId?: string) {
  return accountId ? `${OFFSET_KEY}:${accountId}` : OFFSET_KEY;
}

export function readOffsets(accountId?: string): Record<string, number> {
  const rows = readJson<Record<string, number>>(offsetKey(accountId), {});
  return rows && typeof rows === "object" ? rows : {};
}

export function writeOffsets(offsets: Record<string, number>, accountId?: string) {
  window.localStorage.setItem(offsetKey(accountId), JSON.stringify(offsets));
}

export function floorIndexes(count: number, offset: number) {
  const onFloor = new Set<number>();
  if (count <= 0) return onFloor;
  const size = count <= 2 ? 1 : Math.min(2, count);
  const start = ((offset % count) + count) % count;
  for (let step = 0; step < size; step += 1) onFloor.add((start + step) % count);
  return onFloor;
}

export function picturedFloor(items: { src: string }[], offset: number) {
  const pictured = items.flatMap((item, index) => (item.src ? [index] : []));
  const chosen = floorIndexes(pictured.length, offset);
  return new Set(pictured.filter((_, index) => chosen.has(index)));
}
