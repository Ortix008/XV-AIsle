import { randomUUID } from "node:crypto";
import { getDb } from "./db";

export type SmallShop = {
  id: string;
  name: string;
  city: string;
  makes: string;
  madeInUsa: boolean;
};

type Row = {
  id: string;
  name: string;
  city: string;
  makes: string;
  made_in_usa: number;
};

function fromRow(row: Row): SmallShop {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    makes: row.makes,
    madeInUsa: row.made_in_usa === 1,
  };
}

export function listSmallShops() {
  const rows = getDb().prepare("SELECT id, name, city, makes, made_in_usa FROM small_shops ORDER BY name").all() as Row[];
  return rows.map(fromRow);
}

const PLACE_CLAIM = /made in (?:the united states|united states|the usa|usa|america|the us|us)\b/g;
const SHORT_CLAIM = /\b(?:american made|usa made)\b/g;

/** Lowercase, drop dots, turn hyphens into spaces, and collapse whitespace. `starts` maps each normalized index to the original. */
function normalizeMadeIn(value: string) {
  let normalized = "";
  const starts: number[] = [];
  let i = 0;
  while (i < value.length) {
    const ch = value[i]!;
    if (ch === ".") {
      i += 1;
      continue;
    }
    if (ch === "-" || /\s/.test(ch)) {
      const at = i;
      i += 1;
      while (i < value.length && (value[i] === "-" || value[i] === "." || /\s/.test(value[i]!))) i += 1;
      if (normalized.length > 0) {
        starts.push(at);
        normalized += " ";
      }
      continue;
    }
    starts.push(i);
    normalized += ch.toLowerCase();
    i += 1;
  }
  if (normalized.endsWith(" ")) {
    normalized = normalized.slice(0, -1);
    starts.pop();
  }
  return { normalized, starts };
}

function claimRanges(value: string) {
  const { normalized, starts } = normalizeMadeIn(value);
  const ranges: Array<[number, number]> = [];
  for (const pattern of [PLACE_CLAIM, SHORT_CLAIM]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null = pattern.exec(normalized);
    while (match) {
      const from = starts[match.index];
      const endNorm = match.index + match[0].length;
      const to = endNorm < starts.length ? starts[endNorm] : value.length;
      if (from != null && to > from) ranges.push([from, to]);
      match = pattern.exec(normalized);
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (!last || range[0] > last[1]) merged.push([range[0], range[1]]);
    else last[1] = Math.max(last[1], range[1]);
  }
  return merged;
}

function tidyRemainder(value: string) {
  let text = value.replace(/\s+/g, " ").trim();
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  text = text.replace(/(?:\s*\.\s*|,\s*){2,}/g, (chunk) => (chunk.includes(".") ? "." : ", "));
  text = text.replace(/^[\s,]+/, "");
  text = text.replace(/\s{2,}/g, " ");
  text = text.replace(/\s+([,.;:!?])/g, "$1");
  return text.trim();
}

function withoutMadeIn(value: string) {
  const ranges = claimRanges(value);
  let kept = "";
  let cursor = 0;
  for (const [from, to] of ranges) {
    kept += value.slice(cursor, from);
    cursor = to;
  }
  kept += value.slice(cursor);
  return tidyRemainder(kept);
}

/** Shoppers see the name and what the shop makes. The city and made-in claims stay off. */
export function publicSmallShop(shop: SmallShop) {
  return {
    id: shop.id,
    name: withoutMadeIn(shop.name),
    makes: withoutMadeIn(shop.makes),
  };
}

export function addSmallShop(
  accountId: string,
  input: { name: string; city: string; makes: string; madeInUsa: boolean },
) {
  const name = input.name.trim();
  const city = input.city.trim();
  const makes = input.makes.trim();
  if (name.length < 2 || name.length > 80) return { error: "Add the business name." as const };
  if (city.length < 2 || city.length > 80) return { error: "Add the city." as const };
  if (makes.length < 2 || makes.length > 200) return { error: "Say what they make, in a short line." as const };
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO small_shops (id, account_id, name, city, makes, made_in_usa, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, accountId, name, city, makes, input.madeInUsa ? 1 : 0, Date.now());
  return { shop: fromRow({ id, name, city, makes, made_in_usa: input.madeInUsa ? 1 : 0 }) };
}
