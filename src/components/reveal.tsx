"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

type RevealTag = "div" | "li" | "article" | "section";

const FALLBACK_MS = 1000;

let observer: IntersectionObserver | null = null;
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

function show(node: HTMLElement) {
  node.classList.add("is-in");
  observer?.unobserve(node);
  clearTimer(node);
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

function arm(node: HTMLElement) {
  if (reducedMotion() || !canObserve()) {
    show(node);
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
  clearTimer(node);
}

function revealStyle(index: number): CSSProperties {
  return { "--reveal": Math.min(index, 4) } as CSSProperties;
}

export function useReveal<T extends HTMLElement>(index = 0) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    arm(node);
    return () => disarm(node);
  }, []);
  return {
    ref,
    "data-reveal": "",
    style: revealStyle(index),
  };
}

export function Reveal({
  as = "div",
  index = 0,
  className,
  children,
}: {
  as?: RevealTag;
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    arm(node);
    return () => disarm(node);
  }, []);

  const style = revealStyle(index);
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
