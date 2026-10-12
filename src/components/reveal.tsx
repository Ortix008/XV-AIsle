"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode, type Ref } from "react";

type RevealTag = "div" | "li" | "article" | "section";

let observer: IntersectionObserver | null = null;

function motionObserver() {
  if (observer) return observer;
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        observer?.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.16 },
  );
  return observer;
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function arm(node: HTMLElement) {
  if (reducedMotion() || typeof IntersectionObserver === "undefined") {
    node.classList.add("is-in");
    return;
  }
  const rect = node.getBoundingClientRect();
  const height = window.innerHeight || document.documentElement.clientHeight;
  const seen = rect.bottom > 0 && rect.top < height * 0.92;
  if (seen) node.classList.add("is-in");
  else motionObserver().observe(node);
  document.documentElement.classList.add("motion");
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
    return () => observer?.unobserve(node);
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
    return () => observer?.unobserve(node);
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
