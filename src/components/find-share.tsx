"use client";

import { useSyncExternalStore } from "react";
import { buyerShareHref } from "@/lib/x-share";

function subscribe() {
  return () => {};
}

function origin() {
  return window.location.origin;
}

function noOrigin() {
  return null;
}

export function FindShare({ title, productId }: { title: string; productId: string }) {
  const host = useSyncExternalStore(subscribe, origin, noOrigin);
  if (!host) return null;
  const href = buyerShareHref({ title, productUrl: `${host}/shop/${productId}` });
  return (
    <a className="pill pill-ghost" href={href} target="_blank" rel="noreferrer">
      Share your find on X
    </a>
  );
}
