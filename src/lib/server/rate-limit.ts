import { getDb } from "./db";

export function allowAttempt(key: string, limit: number, windowMs: number) {
  const db = getDb();
  const now = Date.now();
  db.prepare("DELETE FROM rate_hits WHERE at < ?").run(now - windowMs);
  const row = db.prepare("SELECT COUNT(*) AS n FROM rate_hits WHERE key = ? AND at >= ?").get(key, now - windowMs) as {
    n: number;
  };
  if (row.n >= limit) return false;
  db.prepare("INSERT INTO rate_hits (key, at) VALUES (?, ?)").run(key, now);
  return true;
}

export function clientBucket(request: Request, bucket: string) {
  // A client can invent X-Forwarded-For. Use it only when a reverse proxy
  // appends the address it actually saw, and take that last hop.
  const trustProxy = process.env.TRUST_PROXY === "1";
  const forwarded = trustProxy
    ? (request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean).at(-1) ?? "")
    : "";
  const ip = (forwarded || "local").slice(0, 64);
  return `${bucket}:${ip}`;
}
