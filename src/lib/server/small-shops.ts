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
