"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

type RevealTag = "div" | "li" | "article" | "section";

const FALLBACK_MS = 1000;
const SHOP_FALLBACK_MS = 1200;

type RevealPace = "page" | "shop";

let observer: IntersectionObserver | null = null;
let shopObserver: IntersectionObserver | null = null;
const timers = new WeakMap<HTMLElement, number>();

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function canObserve() {
  return typeof IntersectionObserver === "function" && !reducedMotion();
}

function inViewport(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  const height = window.innerHeight || document.documentElement.clientHeight;
  const width = window.innerWidth || document.documentElement.clientWidth;
  if (height <= 0 || width <= 0 || rect.width <= 0 || rect.height <= 0) return true;
  return rect.bottom > 0 && rect.right > 0 && rect.top < height && rect.left < width;
}

function clearTimer(node: HTMLElement) {
  const timer = timers.get(node);
  if (timer == null) return;
  window.clearTimeout(timer);
  timers.delete(node);
}

function settle(node: HTMLElement) {
  const finish = () => node.classList.add("is-settled");
  node.addEventListener(
    "transitionend",
    (event) => {
      if (event.target !== node) return;
      finish();
    },
    { once: true },
  );
  window.setTimeout(finish, SHOP_FALLBACK_MS);
}

function show(node: HTMLElement, pace: RevealPace = "page") {
  node.classList.add("is-in");
  observer?.unobserve(node);
  shopObserver?.unobserve(node);
  clearTimer(node);
  if (pace === "shop") settle(node);
}

function motionObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        show(entry.target as HTMLElement);
      }
    },
    { rootMargin: "0px", threshold: 0 },
  );
  return observer;
}

function shopMotionObserver() {
  if (shopObserver) return shopObserver;
  shopObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        show(entry.target as HTMLElement, "shop");
      }
    },
    { rootMargin: "0px 0px -6% 0px", threshold: 0.12 },
  );
  return shopObserver;
}

function arm(node: HTMLElement, pace: RevealPace) {
  if (reducedMotion() || !canObserve()) {
    show(node, pace);
    return;
  }
  if (pace === "shop") {
    document.documentElement.classList.add("motion");
    void document.documentElement.offsetWidth;
    shopMotionObserver().observe(node);
    const timer = window.setTimeout(() => show(node, "shop"), SHOP_FALLBACK_MS);
    timers.set(node, timer);
    return;
  }
  if (inViewport(node)) show(node);
  else motionObserver().observe(node);
  document.documentElement.classList.add("motion");
  const timer = window.setTimeout(() => show(node), FALLBACK_MS);
  timers.set(node, timer);
}

function disarm(node: HTMLElement) {
  observer?.unobserve(node);
  shopObserver?.unobserve(node);
  clearTimer(node);
}

function revealStyle(index: number, pace: RevealPace): CSSProperties {
  const reveal = pace === "shop" ? index : Math.min(index, 4);
  return { "--reveal": reveal } as CSSProperties;
}

export function useReveal<T extends HTMLElement>(index = 0, pace: RevealPace = "page") {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    arm(node, pace);
    return () => disarm(node);
  }, [pace]);
  return {
    ref,
    "data-reveal": "",
    style: revealStyle(index, pace),
  };
}

export function Reveal({
  as = "div",
  index = 0,
  pace = "page",
  className,
  children,
}: {
  as?: RevealTag;
  index?: number;
  pace?: RevealPace;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    arm(node, pace);
    return () => disarm(node);
  }, [pace]);

  const style = revealStyle(index, pace);
  switch (as) {
    case "li":
      return (
        <li ref={ref as Ref<HTMLLIElement>} data-reveal="" className={className} style={style}>
          {children}
        </li>
      );
    case "article":
      return (
        <article ref={ref as Ref<HTMLElement>} data-reveal="" className={className} style={style}>
          {children}
        </article>
      );
    case "section":
      return (
        <section ref={ref as Ref<HTMLElement>} data-reveal="" className={className} style={style}>
          {children}
        </section>
      );
    case "div":
      return (
        <div ref={ref as Ref<HTMLDivElement>} data-reveal="" className={className} style={style}>
          {children}
        </div>
      );
    default: {
      const exhaustive: never = as;
      return exhaustive;
    }
  }
}
