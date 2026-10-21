"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { HOW_WE_CHECK_HREF } from "@/lib/honest-price";
import { useOptionalAccount } from "@/lib/account-store";
import { cn } from "cn";

function OperatorDeskLink({ className }: { className: string }) {
  const session = useOptionalAccount();
  if (session?.account?.role !== "admin") return null;
  return (
    <Link href="/desk" className={className}>
      Desk
    </Link>
  );
}

const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/shop/usa", label: "Made in the USA" },
  { href: "/shop/small", label: "Small business" },
  { href: "/#aisles", label: "Aisles" },
  { href: HOW_WE_CHECK_HREF, label: "How we check" },
  { href: "/account", label: "Account" },
];

function focusable(button: HTMLButtonElement | null, panel: HTMLElement | null) {
  const links = panel ? [...panel.querySelectorAll<HTMLElement>("a[href]")] : [];
  return button ? [button, ...links] : links;
}

export function StoreHeader() {
  const sentinel = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);

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

  useEffect(() => {
    const media = window.matchMedia("(min-width: 900px)");
    const closeOnDesktop = () => {
      if (media.matches) setOpen(false);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    const panel = panelRef.current;
    const links = focusable(button, panel).filter((node) => node !== button);
    links[0]?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        button?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = focusable(button, panel);
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (button?.contains(target) || panel?.contains(target)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

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
          <Link href="/" className="brand-home inline-flex min-h-[var(--tap)] min-w-[var(--tap)] shrink-0 items-center">
            {/* Outlined wordmark. Explicit width and height keep the header from shifting. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/xv-aisle-logo.svg" height={32} width={115} alt="XV-AIsle" className="brand-logo" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground min-[900px]:flex" aria-label="Shop">
            {nav.slice(0, 5).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="link-slide inline-flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="header-tools flex shrink-0 items-center text-sm text-muted-foreground">
            <Link
              href="/account"
              className="link-slide hidden min-h-[var(--tap)] min-w-[var(--tap)] items-center hover:text-foreground min-[900px]:inline-flex"
            >
              Account
            </Link>
            <OperatorDeskLink className="link-slide hidden min-h-[var(--tap)] min-w-[var(--tap)] items-center hover:text-foreground min-[900px]:inline-flex" />
            <button
              ref={buttonRef}
              type="button"
              className="inline-flex min-h-[var(--tap)] min-w-[var(--tap)] items-center justify-center rounded-full border border-primary/40 px-3.5 py-1.5 text-foreground shadow-[0_0_18px_rgba(61,220,132,0.18)] min-[900px]:hidden"
              aria-expanded={open}
              aria-controls="shop-menu"
              onClick={() => setOpen((value) => !value)}
            >
              Menu
            </button>
          </div>
        </div>
        <nav
          id="shop-menu"
          ref={panelRef}
          aria-label="Shop"
          inert={!open}
          className={cn("nav-fold relative z-[1] min-[900px]:hidden", open && "is-open")}
        >
          <div className="nav-fold-clip">
            <ul className="mx-auto flex max-w-[1280px] flex-col px-4 pb-3 sm:px-5">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="nav-fold-link" onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>
    </>
  );
}
