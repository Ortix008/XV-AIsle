"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { placeProduct, type Aisle } from "@/lib/aisles";
import { getProduct } from "@/lib/catalog";
import { useDesk } from "@/lib/desk-store";
import { cn } from "cn";

const statusLabel = {
  review: "In review",
  approved: "Approved",
  passed: "Skipped",
} as const;

export function AisleView({ aisle, onClose }: { aisle: Aisle; onClose: () => void }) {
  const router = useRouter();
  const { state, select } = useDesk();
  const closeRef = useRef(onClose);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [active, setActive] = useState(aisle.sections[0]?.name ?? "");

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusable = [...root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter(
        (node) => !node.hasAttribute("disabled"),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused?.focus();
    };
  }, []);

  function jump(name: string) {
    setActive(name);
    const node = sectionRefs.current[name];
    const scroller = scrollerRef.current;
    if (!node || !scroller) return;
    const chips = scroller.querySelector("[data-aisle-chips]");
    const chipHeight = chips instanceof HTMLElement ? chips.getBoundingClientRect().height : 0;
    const top = node.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - chipHeight;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scroller.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
  }

  const sections = aisle.sections.map((section) => {
    const items = state.pipeline.flatMap((row) => {
      const product = getProduct(row.productId);
      const place = placeProduct(product);
      if (!place || place.aisle !== aisle.title || place.section !== section.name) return [];
      return [
        {
          id: product.id,
          name: product.titleLead,
          src: product.mockups[0]?.src ?? "",
          status: row.status,
        },
      ];
    });
    return { ...section, items };
  });
  const found = sections.reduce((sum, section) => sum + section.items.length, 0);

  function openInSignal(id: string) {
    select("scout", id);
    router.push(`/scout?item=${encodeURIComponent(id)}`);
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label={aisle.title}
    >
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 bg-[#111] px-4 py-2 text-white">
        <button
          ref={closeButtonRef}
          type="button"
          className="text-xs text-white/70 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-live"
          onClick={onClose}
        >
          Close
        </button>
        <span className="grid h-7 w-8 place-items-center bg-live text-[11px] font-semibold tracking-tight text-[#111]">
          XV
        </span>
        <h2 className="min-w-0 truncate text-sm font-semibold tracking-[0.18em]">{aisle.title}</h2>
        <p className="ml-auto flex items-center gap-2 text-xs text-white/70">
          <span className="size-1.5 rounded-full bg-live" aria-hidden />
          Signal · {found}
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        <nav aria-label="Sections" className="hidden w-52 shrink-0 border-r bg-card lg:block">
          <ul className="sticky top-0 py-3">
            {sections.map((section, index) => (
              <li key={section.name}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full items-baseline justify-between px-5 py-2.5 text-left text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-foreground",
                    active === section.name ? "bg-secondary font-medium" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => jump(section.name)}
                >
                  <span className="flex items-baseline gap-3">
                    <span className="w-5 text-[11px] tabular-nums tracking-wide text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.name}
                  </span>
                  <span className="text-xs tabular-nums">{section.items.length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div ref={scrollerRef} className="min-w-0 flex-1 overflow-y-auto">
          <div data-aisle-chips className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur lg:hidden">
            {sections.map((section) => (
              <button
                key={section.name}
                type="button"
                className={cn(
                  "shrink-0 rounded-full border px-3 py-1 text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
                  active === section.name ? "border-foreground bg-foreground text-background" : "bg-card text-foreground",
                )}
                onClick={() => jump(section.name)}
              >
                {section.name}
              </button>
            ))}
          </div>

          {sections.map((section, index) => (
            <section
              key={section.name}
              ref={(node) => {
                sectionRefs.current[section.name] = node;
              }}
              className="border-b px-4 py-5 sm:px-6"
            >
              <div className="mb-3 flex items-baseline gap-3">
                <p className="text-[11px] tabular-nums tracking-wide text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="text-sm font-medium tracking-[0.14em] uppercase">{section.name}</h3>
                <p className="text-xs tabular-nums text-muted-foreground">{section.items.length}</p>
              </div>
              {section.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Signal has not found one here yet.</p>
              ) : (
                <ul className="flex gap-2 overflow-x-auto pb-1">
                  {section.items.map((item) => (
                    <li key={item.id} className="w-44 shrink-0 sm:w-52">
                      <button
                        type="button"
                        className="relative block aspect-square w-full bg-card text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                        aria-label={`Open ${item.name} in Signal`}
                        onClick={() => openInSignal(item.id)}
                      >
                        {item.src ? (
                          <Image src={item.src} alt="" fill sizes="208px" className="object-cover" />
                        ) : (
                          <span className="absolute inset-0 grid place-items-center bg-secondary px-4 pb-10 text-center text-xs text-muted-foreground">
                            Picture when you have one
                          </span>
                        )}
                        <span className="absolute left-2 top-2 bg-black/75 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-white">
                          {statusLabel[item.status]}
                        </span>
                        <span className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2">
                          <span className="block text-sm font-medium text-white">{item.name}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
