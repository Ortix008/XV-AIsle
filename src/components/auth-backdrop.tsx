"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AUTH_BACKDROP_MEDIA,
  AUTH_MOTE_CAP,
  AUTH_MOTES,
  type AuthBackdropMedia,
  type AuthBackdropVideo,
} from "@/lib/auth-backdrop";

function useDocumentHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sync = () => setHidden(document.hidden);
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return hidden;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  return reduced;
}

function BackdropVideo({
  media,
  paused,
  still,
}: {
  media: AuthBackdropVideo;
  paused: boolean;
  still: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (paused || still) {
      node.pause();
      return;
    }
    void node.play().catch(() => undefined);
  }, [paused, still]);

  return (
    <video
      ref={ref}
      className="auth-plate-media"
      src={media.src}
      poster={media.poster}
      muted
      loop
      playsInline
      autoPlay={!still}
      preload={still ? "metadata" : "auto"}
    />
  );
}

function Plate({
  media,
  paused,
  still,
}: {
  media: AuthBackdropMedia;
  paused: boolean;
  still: boolean;
}) {
  if (media == null) return null;
  switch (media.kind) {
    case "image":
      return <Image src={media.src} alt="" fill sizes="100vw" className="auth-plate-media" />;
    case "video":
      return <BackdropVideo media={media} paused={paused} still={still} />;
    default: {
      const unreachable: never = media;
      return unreachable;
    }
  }
}

function ShelfField({ id, tone }: { id: string; tone: "far" | "near" }) {
  const green = tone === "far" ? "rgba(157,255,196,0.55)" : "rgba(61,220,132,0.9)";
  const warm = tone === "far" ? "rgba(231,194,122,0.4)" : "rgba(231,194,122,0.82)";
  const fill = tone === "far" ? "rgba(61,220,132,0.03)" : "rgba(61,220,132,0.05)";
  return (
    <svg className={`auth-layer auth-shelves auth-shelves-${tone}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id={`${id}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3ddc84" stopOpacity="0" />
          <stop offset="1" stopColor="#3ddc84" stopOpacity={tone === "far" ? "0.2" : "0.45"} />
        </linearGradient>
      </defs>
      {tone === "far" ? (
        <g fill={fill} stroke={green} strokeWidth="1.1">
          <path d="M620 470 L760 360 H790 L655 490 Z" />
          <path d="M620 430 L760 320 H790 L655 450 Z" />
          <path d="M980 470 L840 360 H810 L945 490 Z" />
          <path d="M980 430 L840 320 H810 L945 450 Z" />
          <path d="M700 560 L800 470 L900 560" fill="none" stroke={warm} />
        </g>
      ) : (
        <g fill={fill} strokeLinejoin="round">
          <g stroke={green} strokeWidth="1.5">
            <path d="M48 860 L470 530 H530 L108 900 Z" />
            <path d="M48 790 L470 460 H530 L108 830 Z" />
            <path d="M48 720 L470 390 H530 L108 760 Z" />
            <path d="M150 900 L500 560" fill="none" />
            <path d="M250 900 L540 520" fill="none" opacity="0.7" />
          </g>
          <g stroke={warm} strokeWidth="1.5">
            <path d="M1552 860 L1130 530 H1070 L1492 900 Z" />
            <path d="M1552 790 L1130 460 H1070 L1492 830 Z" />
            <path d="M1552 720 L1130 390 H1070 L1492 760 Z" />
            <path d="M1450 900 L1100 560" fill="none" />
            <path d="M1350 900 L1060 520" fill="none" opacity="0.7" />
          </g>
          <g fill="none" stroke={green} strokeWidth="1.2" opacity="0.8">
            <path d="M180 250 H420" />
            <path d="M180 250 V310" />
            <circle cx="300" cy="248" r="7" fill="#3ddc84" stroke="none" opacity="0.9" />
            <path d="M1180 230 H1460" />
            <path d="M1460 230 V300" />
            <circle cx="1320" cy="228" r="7" fill="#e7c27a" stroke="none" />
          </g>
          <path d="M800 900 L800 340" stroke={`url(#${id}-floor)`} fill="none" strokeWidth="1.4" />
        </g>
      )}
    </svg>
  );
}

export function AuthBackdrop({ media = AUTH_BACKDROP_MEDIA }: { media?: AuthBackdropMedia }) {
  const hidden = useDocumentHidden();
  const still = usePrefersReducedMotion();
  const rawId = useId().replace(/:/g, "");
  const motes = AUTH_MOTES.slice(0, AUTH_MOTE_CAP);

  return (
    <div className="auth-stage" data-paused={hidden ? "true" : "false"} aria-hidden>
      <div className="auth-layer auth-wash" />
      <div className="auth-layer auth-plate">
        <Plate media={media} paused={hidden} still={still} />
      </div>
      <ShelfField id={`${rawId}-far`} tone="far" />
      <svg className="auth-layer auth-trails" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${rawId}-trail`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="#3ddc84" stopOpacity="0" />
            <stop offset="0.5" stopColor="#e9fff3" stopOpacity="0.95" />
            <stop offset="1" stopColor="#3ddc84" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${rawId}-warm`} x1="1" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#e7c27a" stopOpacity="0" />
            <stop offset="0.55" stopColor="#fff4d4" stopOpacity="0.9" />
            <stop offset="1" stopColor="#e7c27a" stopOpacity="0" />
          </linearGradient>
          <filter id={`${rawId}-blur`}>
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>
        <g className="auth-trail auth-trail-a" filter={`url(#${rawId}-blur)`}>
          <path d="M120 880 C 420 640, 620 460, 800 300" fill="none" stroke={`url(#${rawId}-trail)`} strokeWidth="3" />
          <path d="M260 900 C 520 700, 680 520, 820 360" fill="none" stroke={`url(#${rawId}-trail)`} strokeWidth="1.4" opacity="0.7" />
        </g>
        <g className="auth-trail auth-trail-b" filter={`url(#${rawId}-blur)`}>
          <path d="M1480 880 C 1180 640, 980 460, 800 300" fill="none" stroke={`url(#${rawId}-warm)`} strokeWidth="3" />
          <path d="M1340 900 C 1080 700, 920 520, 780 360" fill="none" stroke={`url(#${rawId}-warm)`} strokeWidth="1.4" opacity="0.7" />
        </g>
      </svg>
      <ShelfField id={`${rawId}-near`} tone="near" />
      <div className="auth-layer auth-motes">
        {motes.map((mote) => (
          <span
            key={`${mote.x}-${mote.y}`}
            className="auth-mote"
            style={
              {
                "--x": mote.x,
                "--y": mote.y,
                "--dx": mote.dx,
                "--dy": mote.dy,
                "--delay": mote.delay,
                "--dur": mote.duration,
              } as CSSProperties
            }
          />
        ))}
      </div>
      <div className="auth-layer auth-grain" />
      <div className="auth-layer auth-scrim" />
    </div>
  );
}

export function AuthPane({ children }: { children: ReactNode }) {
  return (
    <div className="auth-screen auth-screen-pane">
      <AuthBackdrop />
      <div className="auth-screen-body">
        <div className="auth-glass auth-glass-wide">{children}</div>
      </div>
    </div>
  );
}
