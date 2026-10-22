import { getDb } from "./db";

/** Longest window any caller passes to allowAttempt. Rows older than this cannot still count. */
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

const RATE_SWEEP_GAP_MS = 60 * 1000;

let lastRateSweep = 0;

/** Deletes rate_hits older than the longest bucket so the table stays bounded. */
export function sweepRateHits(now = Date.now()) {
  getDb().prepare("DELETE FROM rate_hits WHERE at < ?").run(now - RATE_LIMIT_WINDOW_MS);
  lastRateSweep = now;
}

function sweepRateHitsOnWrite(now: number) {
  if (now - lastRateSweep < RATE_SWEEP_GAP_MS) return;
  sweepRateHits(now);
}

/** True when this key is already full. Does not record a new hit. */
export function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const row = getDb().prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at >= ?").get(key, now - windowMs) as {
    n: number | bigint;
  };
  return Number(row.n) >= limit;
}

export function allowAttempt(key: string, limit: number, windowMs: number) {
  const db = getDb();
  const now = Date.now();
  sweepRateHitsOnWrite(now);
  db.prepare("DELETE FROM rate_hits WHERE key = ? AND at < ?").run(key, now - windowMs);
  const row = db.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at >= ?").get(key, now - windowMs) as {
    n: number;
  };
  if (row.n >= limit) return false;
  db.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run(key, now);
  return true;
}

/**
 * Address of the visitor, when a reverse proxy appended it.
 * Without TRUST_PROXY the header is ignored. There is no shared "local"
 * bucket: one client must not be able to fill a limit that blocks everyone.
 */
export function clientBucket(request: Request, bucket: string) {
  if (process.env.TRUST_PROXY !== "1") return null;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "";
  if (!forwarded) return null;
  return `${bucket}:${forwarded.slice(0, 64)}`;
}

/** Per-IP limit. Skipped when the client address is not trusted. */
export function allowClient(request: Request, bucket: string, limit: number, windowMs: number) {
  const key = clientBucket(request, bucket);
  if (!key) return true;
  return allowAttempt(key, limit, windowMs);
}

/** True when that visitor's bucket is already full. */
export function clientLimited(request: Request, bucket: string, limit: number, windowMs: number) {
  const key = clientBucket(request, bucket);
  if (!key) return false;
  return rateLimited(key, limit, windowMs);
}

/** Per-account limit. An empty id does not fall back to one shared bucket. */
export function allowAccount(bucket: string, account: string, limit: number, windowMs: number) {
  const id = account.trim().toLowerCase();
  if (!id) return true;
  return allowAttempt(`${bucket}:account:${id.slice(0, 200)}`, limit, windowMs);
}

/** True when that account's bucket is already full. */
export function accountLimited(bucket: string, account: string, limit: number, windowMs: number) {
  const id = account.trim().toLowerCase();
  if (!id) return false;
  return rateLimited(`${bucket}:account:${id.slice(0, 200)}`, limit, windowMs);
}
