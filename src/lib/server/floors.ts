import { getDb } from "./db";
import { enterpriseFloors, floorById, isFloorStatus, type FloorStatus } from "../floors";

export type FloorReach = {
  id: string;
  name: string;
  holds: string;
  status: FloorStatus;
  contact: string;
};

type ReachRow = {
  floor_id: string;
  status: string;
  contact: string;
};

export function listFloorReach(accountId: string): FloorReach[] {
  const rows = getDb().prepare("SELECT floor_id, status, contact FROM floor_reach WHERE account_id = ?").all(accountId) as ReachRow[];
  const saved = new Map(rows.map((row) => [row.floor_id, row]));
  return enterpriseFloors.map((floor) => {
    const row = saved.get(floor.id);
    const status = row && isFloorStatus(row.status) ? row.status : "open";
    return {
      id: floor.id,
      name: floor.name,
      holds: floor.holds,
      status,
      contact: row?.contact ?? "",
    };
  });
}

export function saveFloorReach(
  accountId: string,
  input: { floorId: string; status: string; contact: string },
) {
  const floor = floorById(input.floorId);
  if (!floor) return { error: "That floor is not on the list." as const };
  if (!isFloorStatus(input.status)) return { error: "Pick where the conversation is." as const };
  const contact = input.contact.trim();
  if (contact.length > 120) return { error: "That contact is too long." as const };
  if (contact && (!contact.includes("@") || !contact.includes("."))) {
    return { error: "Use an email for the contact, or leave it blank." as const };
  }
  getDb()
    .prepare(
      `INSERT INTO floor_reach (account_id, floor_id, status, contact, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account_id, floor_id) DO UPDATE SET
         status = excluded.status,
         contact = excluded.contact,
         updated_at = excluded.updated_at`,
    )
    .run(accountId, floor.id, input.status, contact, Date.now());
  return { floor: listFloorReach(accountId).find((item) => item.id === floor.id)! };
}
