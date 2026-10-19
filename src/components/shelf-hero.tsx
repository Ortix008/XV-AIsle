"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { HERO_EYEBROW } from "@/lib/hero-copy";

const steps = [
  { n: "1", title: "The brand", detail: "lists its extra stock" },
  { n: "2", title: "A reseller", detail: "picks it for you" },
  { n: "3", title: "You", detail: "get it from the brand" },
] as const;

const boxes = [
  { tone: "a", delay: "0s" },
  { tone: "b", delay: "-1.6s" },
  { tone: "c", delay: "-3.5s" },
  { tone: "d", delay: "-5.1s" },
  { tone: "e", delay: "-7.4s" },
] as const;

export function ShelfHero() {
  const worldRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const world = worldRef.current;
    const mark = markRef.current;
    const tag = tagRef.current;
    if (!world || !mark || !tag) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    let frame = 0;
    const tick = () => {
      const bounds = world.getBoundingClientRect();
      const gate = mark.getBoundingClientRect();
      const x = Math.round(gate.left - bounds.left);
      const y = Math.round(gate.top - bounds.top);
      tag.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="up1" aria-labelledby="home-hero">
      <div className="up1-copy">
        <p className="up1-eye">{HERO_EYEBROW}</p>
        <h1 id="home-hero" className="up1-h1">
          From their shelf
          <br />
          to your home.
        </h1>
        <p className="up1-sub">
          Everyday things for your home, your desk, and the people you love, picked one by one. See where each item
          ships from and when it usually ships.
        </p>
        <div className="up1-actions">
          <Link href="/shop" className="pill pill-primary">
            Shop the aisles
          </Link>
          <Link href="/shop/reseller" className="pill pill-ghost">
            Sell with us
          </Link>
        </div>
        <p className="up1-trust">
          <svg viewBox="0 0 24 24" aria-hidden width="16" height="16">
            <rect x="5" y="11" width="14" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          Secure checkout
        </p>
        <ol className="up1-steps up1-steps-desk">
          {steps.map((step) => (
            <li key={step.n} className="up1-card">
              <span>{step.n}</span>
              <strong>{step.title}</strong>
              <em>{step.detail}</em>
            </li>
          ))}
        </ol>
      </div>
      <div className="up1-world" ref={worldRef}>
        <div className="up1-cam">
          <div className="up1-haze" />
          <div className="up1-pool" />
          <div className="up1-floor" />
          <div className="up1-shelf">
            <span>THE BRAND</span>
          </div>
          {boxes.map((box) => (
            <span key={box.delay} className={`up1-box up1-box-${box.tone}`} style={{ animationDelay: box.delay }} />
          ))}
          <div className="up1-gate">
            <span className="up1-post">
              <span className="up1-gmark" ref={markRef} />
            </span>
            <span className="up1-post" />
          </div>
        </div>
        <span className="up1-rtag" ref={tagRef}>
          A RESELLER
        </span>
      </div>
      <ol className="up1-steps up1-steps-phone">
        {steps.map((step) => (
          <li key={step.n} className="up1-card">
            <span>{step.n}</span>
            <strong>{step.title}</strong>
            <em>{step.detail}</em>
          </li>
        ))}
      </ol>
    </section>
  );
}
