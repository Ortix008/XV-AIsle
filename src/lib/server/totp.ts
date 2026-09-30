import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function key() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") return null;
    return createHash("sha256").update("xvaisle-dev-totp").digest();
  }
  return createHash("sha256").update(secret).digest();
}

export function authSecretReady() {
  return key() !== null;
}

export function generateTotpSecret() {
  return base32Encode(randomBytes(20));
}

export function encryptSecret(secret: string) {
  const material = key();
  if (!material) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", material, iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${encrypted.toString("hex")}`;
}

export function decryptSecret(stored: string) {
  const material = key();
  if (!material) return null;
  const [ivHex, tagHex, dataHex] = stored.split(".");
  if (!ivHex || !tagHex || !dataHex) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", material, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function totpCode(secret: string, at = Date.now()) {
  const counter = Math.floor(at / 30_000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1]! & 0xf;
  const bin =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return String(bin % 1_000_000).padStart(6, "0");
}

export function verifyTotp(secret: string, code: string, at = Date.now()) {
  const normalized = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const given = Buffer.from(normalized);
  for (const skew of [-1, 0, 1]) {
    const expected = Buffer.from(totpCode(secret, at + skew * 30_000));
    if (given.length === expected.length && timingSafeEqual(given, expected)) return true;
  }
  return false;
}

function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string) {
  const clean = input.replace(/=+$/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
