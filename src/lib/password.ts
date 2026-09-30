const ITERATIONS = 180_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

export const DUMMY_PASSWORD_HASH =
  "pbkdf2$180000$AQEBAQEBAQEBAQEBAQEBAQ==$AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgI=";

export function timingSafeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`;
}

export async function verifyPassword(email: string, password: string, stored: string) {
  if (stored.startsWith("pbkdf2$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return { ok: false as const };
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 2_000_000) {
      return { ok: false as const };
    }
    let salt: Uint8Array;
    let expected: string;
    try {
      salt = base64ToBytes(parts[2]);
      expected = bytesToBase64(base64ToBytes(parts[3]));
    } catch {
      return { ok: false as const };
    }
    if (salt.length < 16) return { ok: false as const };
    const actual = bytesToBase64(await pbkdf2(password, salt, iterations));
    const ok = timingSafeEqual(actual, expected);
    return ok ? { ok: true as const } : { ok: false as const };
  }

  if (/^[0-9a-f]{64}$/.test(stored)) {
    const legacy = await sha256Hex(`${email}:${password}`);
    if (!timingSafeEqual(legacy, stored)) return { ok: false as const };
    return { ok: true as const, upgrade: await hashPassword(password) };
  }

  await pbkdf2(password, base64ToBytes("AQEBAQEBAQEBAQEBAQEBAQ=="), ITERATIONS);
  return { ok: false as const };
}
