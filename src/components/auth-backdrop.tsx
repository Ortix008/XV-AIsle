"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { XvAisleFlow } from "@/components/xvaisle-flow";
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

export function AuthBackdrop({ media = AUTH_BACKDROP_MEDIA }: { media?: AuthBackdropMedia }) {
  const hidden = useDocumentHidden();
  const still = usePrefersReducedMotion();
  const motes = AUTH_MOTES.slice(0, AUTH_MOTE_CAP);

  return (
    <div className="auth-stage" data-paused={hidden ? "true" : "false"} aria-hidden>
      <div className="auth-layer auth-wash" />
      <div className="auth-layer auth-plate">
        <Plate media={media} paused={hidden} still={still} />
      </div>
      <div className="auth-layer auth-flow">
        <XvAisleFlow density="light" />
      </div>
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
