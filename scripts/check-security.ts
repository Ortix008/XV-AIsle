import { buildDeskFixture } from "./fixtures/desk-fixture";
import { deskStorageKey, purgeOldDesks, sanitizeDesk } from "../src/lib/desk-state";
import { DUMMY_PASSWORD_HASH, hashPassword, timingSafeEqual, verifyPassword } from "../src/lib/password";
import {
  bankOnFile,
  cardOnFile,
  checkBank,
  checkCard,
  checkWallet,
  payoutStorageKey,
  walletOnFile,
} from "../src/lib/payout";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function memoryStorage(initial: Record<string, string>): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, value);
    },
  };
}

async function main() {
const password = "market-pass";
const email = "seller@example.com";
const stored = await hashPassword(password);
assert(stored.startsWith("pbkdf2$"), "new passwords use PBKDF2");
assert(!stored.includes(password), "the password is not stored");
const ok = await verifyPassword(email, password, stored);
assert(ok.ok && !("upgrade" in ok), "a fresh hash verifies");
const wrong = await verifyPassword(email, "not-the-password", stored);
assert(!wrong.ok, "a wrong password fails");

const legacy = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${email}:${password}`));
const legacyHex = [...new Uint8Array(legacy)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const upgraded = await verifyPassword(email, password, legacyHex);
const nextHash = upgraded.ok && "upgrade" in upgraded && typeof upgraded.upgrade === "string" ? upgraded.upgrade : "";
assert(nextHash.startsWith("pbkdf2$"), "old hashes upgrade");
const upgradedOk = await verifyPassword(email, password, nextHash);
assert(upgradedOk.ok, "the upgraded hash verifies");
assert(!(await verifyPassword(email, password, DUMMY_PASSWORD_HASH)).ok, "the dummy hash does not unlock an account");
assert(timingSafeEqual("abc", "abc") && !timingSafeEqual("abc", "abd"), "compare checks every character");

const number = "4242424242424242";
assert(checkCard({ name: "Example Seller", number, expiry: "12/30" }) == null, "a valid card passes");
assert(checkCard({ name: "Example Seller", number: "4242424242424241", expiry: "12/30" }), "a bad card number fails");
const onFile = cardOnFile(number);
assert(onFile.last4 === "4242" && !JSON.stringify(onFile).includes(number.slice(0, 8)), "only the last four are kept");
assert(checkBank({ routing: "021000021", account: "123456789" }) == null, "a valid bank account passes");
assert(bankOnFile("123456789").last4 === "6789", "bank storage keeps four digits");
assert(checkWallet("bitcoin", "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq") == null, "a bitcoin address passes");
assert(checkWallet("dogecoin", "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L") == null, "a dogecoin address passes");
assert(walletOnFile("bitcoin").last4 === "0000" && walletOnFile("bitcoin").method === "bitcoin", "wallets are not stored");
assert(payoutStorageKey("one") !== payoutStorageKey("two"), "payouts are stored per account");

const today = "2026-09-30";
const fixture = buildDeskFixture(today);
const clean = sanitizeDesk(fixture, today);
assert(clean?.pipeline.length === fixture.pipeline.length, "a real desk survives the check");
assert(clean?.orders.length === fixture.orders.length, "orders survive the check");
assert(clean?.listings.length === fixture.listings.length, "listings survive the check");
const poisoned = sanitizeDesk(
  {
    ...fixture,
    pipeline: [...fixture.pipeline, { productId: "not-a-product", status: "review", discoveredOn: today, pickedSupplierId: null }],
    listings: [{ ...fixture.listings[0], description: "x".repeat(20000) }],
  },
  today,
);
assert(poisoned && !poisoned.pipeline.some((item) => item.productId === "not-a-product"), "unknown products are dropped");
assert(poisoned && poisoned.listings[0].description.length === 8000, "oversized copy is cut");
assert(sanitizeDesk({ version: 2 }, today) == null, "an old desk file is rejected");
assert(sanitizeDesk({ ...fixture, version: 3 }, today) == null, "a v3 desk is rejected");
assert(deskStorageKey("ada") === "xv-desk:v4:ada", "desks are stored under xv-desk:v4");
assert(deskStorageKey("ada") !== deskStorageKey("bay"), "each account has its own market");

const storage = memoryStorage({
  "aisle-desk-v2": "old",
  "xvaisle-desk-legacy-owner": "ada",
  "xvaisle-desk-v3:x": "v3",
  "xv-desk:v4:x": "v4",
  "unrelated": "keep",
});
purgeOldDesks(storage);
assert(storage.getItem("aisle-desk-v2") == null, "the unscoped desk is removed");
assert(storage.getItem("xvaisle-desk-legacy-owner") == null, "the legacy owner claim is removed");
assert(storage.getItem("xvaisle-desk-v3:x") == null, "v3 desks are removed");
assert(storage.getItem("xv-desk:v4:x") === "v4", "a v4 desk stays");
assert(storage.getItem("unrelated") === "keep", "unrelated keys stay");

console.log("security checks ok");
}

main();
