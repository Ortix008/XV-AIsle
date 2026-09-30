import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 32;
const DUMMY_SALT = randomBytes(16).toString("hex");
const DUMMY_HASH = scryptSync("not-a-real-password", DUMMY_SALT, KEYLEN).toString("hex");

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string) {
  const next = scryptSync(password, salt, KEYLEN);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

/** Spend the same password work when the account does not exist. */
export function burnPasswordCheck(password: string) {
  verifyPassword(password, DUMMY_SALT, DUMMY_HASH);
}
