/**
 * Night-aisle plate behind sign-in, sign-up, password help, and account.
 *
 * Swap the art without editing the component:
 * 1. Put a file in `public/` (for example `public/brand/grok-aisle.webp`
 *    or `public/brand/grok-aisle.mp4`).
 * 2. Change `AUTH_BACKDROP_MEDIA` below.
 *    - Still image: `{ kind: "image", src: "/brand/grok-aisle.webp" }`
 *    - Looping video: `{ kind: "video", src: "/brand/grok-aisle.mp4", poster: "/brand/grok-aisle.webp" }`
 *    - Drawn aisle only: `null`
 *
 * A screen can also pass `media` to `<AuthBackdrop />`. That prop wins over this config.
 * The xvaisle flow, motes, and grain stay. Only the plate in the slot changes.
 *
 * The default plate is the dark green aisle (`/brand/hero-aisle-glow.webp`).
 * Login uses a lighter xvaisle flow on top of that plate.
 */

export type AuthBackdropImage = {
  kind: "image";
  src: string;
};

export type AuthBackdropVideo = {
  kind: "video";
  src: string;
  poster?: string;
};

export type AuthBackdropMedia = AuthBackdropImage | AuthBackdropVideo | null;

export const AUTH_BACKDROP_MEDIA: AuthBackdropMedia = {
  kind: "image",
  src: "/brand/hero-aisle-glow.webp",
};

/** Drawn motes. The stylesheet hides every mote from the 7th onward below 768px. */
export const AUTH_MOTE_CAP = 12;

export const AUTH_MOTES = [
  { x: "8%", y: "78%", dx: "24px", dy: "-120px", delay: "0s", duration: "12s" },
  { x: "18%", y: "64%", dx: "-10px", dy: "-90px", delay: "1.4s", duration: "10s" },
  { x: "27%", y: "82%", dx: "16px", dy: "-140px", delay: "2.2s", duration: "13s" },
  { x: "36%", y: "58%", dx: "8px", dy: "-70px", delay: "0.6s", duration: "9.5s" },
  { x: "46%", y: "74%", dx: "-18px", dy: "-110px", delay: "3s", duration: "11s" },
  { x: "54%", y: "86%", dx: "12px", dy: "-100px", delay: "1.8s", duration: "12.5s" },
  { x: "63%", y: "68%", dx: "20px", dy: "-130px", delay: "0.2s", duration: "10.5s" },
  { x: "71%", y: "80%", dx: "-14px", dy: "-95px", delay: "2.6s", duration: "14s" },
  { x: "79%", y: "60%", dx: "6px", dy: "-80px", delay: "1.1s", duration: "9s" },
  { x: "86%", y: "76%", dx: "-22px", dy: "-120px", delay: "3.4s", duration: "11.5s" },
  { x: "92%", y: "88%", dx: "10px", dy: "-70px", delay: "0.8s", duration: "13.5s" },
  { x: "14%", y: "48%", dx: "28px", dy: "-60px", delay: "2s", duration: "15s" },
] as const;
