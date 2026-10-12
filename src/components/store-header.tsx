"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { HOW_WE_CHECK_HREF } from "@/lib/honest-price";
import { cn } from "cn";

const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/shop/usa", label: "Made in the USA" },
  { href: "/shop/small", label: "Small business" },
  { href: "/#aisles", label: "Aisles" },
  { href: HOW_WE_CHECK_HREF, label: "How we check" },
];

export function StoreHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const node = sentinel.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const watch = new IntersectionObserver(([entry]) => {
      setCompact(entry ? !entry.isIntersecting : false);
    });
    watch.observe(node);
    return () => watch.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden className="h-px w-full" />
      <header
        className={cn(
          "store-header sticky top-0 z-30 border-b border-border bg-[#07080a]/95",
          compact && "is-compact",
        )}
      >
        <div className="store-header-veil" aria-hidden />
        <div className="store-header-bar relative z-[1] mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-3 px-4 min-[900px]:h-[68px] min-[900px]:gap-4 min-[900px]:px-10 sm:px-5">
          <Link href="/" className="min-w-0">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-[30px] text-sm text-muted-foreground min-[900px]:flex" aria-label="Shop">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="link-slide hover:text-foreground">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/shop" className="link-slide hover:text-foreground">
              Search
            </Link>
            <Link href="/#account" className="link-slide hidden hover:text-foreground min-[900px]:inline">
              Account
            </Link>
            <Link href="/shop/cart" className="rounded-full border border-border px-3.5 py-1.5 text-foreground hover:border-primary">
              Cart
            </Link>
          </div>
        </div>
        <nav
          className="relative z-[1] flex gap-4 overflow-x-auto px-4 pb-3 text-sm text-muted-foreground min-[900px]:hidden"
          aria-label="Shop"
        >
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="link-slide shrink-0 hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <Link href="/#account" className="link-slide shrink-0 hover:text-foreground">
            Account
          </Link>
        </nav>
      </header>
    </>
  );
}
