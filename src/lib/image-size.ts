import { readFileSync } from "node:fs";
import { join } from "node:path";

export type ImageSize = { width: number; height: number };

function pngSize(bytes: Buffer): ImageSize | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegSize(bytes: Buffer): ImageSize | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }
    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

export function imageSize(bytes: Buffer): ImageSize | null {
  return pngSize(bytes) ?? jpegSize(bytes);
}

/** Pixel size of a file under public/. Remote URLs and paths outside that folder are skipped. */
export function publicImageSize(publicPath: string): ImageSize | null {
  if (!publicPath.startsWith("/") || publicPath.includes("..") || publicPath.includes("\0")) return null;
  try {
    return imageSize(readFileSync(join(process.cwd(), "public", publicPath.slice(1))));
  } catch {
    return null;
  }
}
