"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { money, pct } from "@/lib/money";
import type { MockupIdea } from "@/lib/types";
import { cn } from "cn";

export function PageHeader({
  kicker,
  title,
  lede,
  actions,
}: {
  kicker: string;
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-background/95 px-4 py-4 backdrop-blur-sm sm:px-6 lg:static lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          {kicker}
        </p>
        <h1 className="text-balance text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 max-w-2xl text-pretty text-sm text-muted-foreground">{lede}</p>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function marginTone(margin: number) {
  if (margin >= 0.32) return "ok" as const;
  if (margin >= 0.25) return "warn" as const;
  return "late" as const;
}

const toneClass = {
  ok: "text-ok",
  warn: "text-warn",
  late: "text-late",
  muted: "text-muted-foreground",
};

export function Tone({
  tone,
  children,
}: {
  tone: keyof typeof toneClass;
  children: ReactNode;
}) {
  return <span className={cn("font-medium", toneClass[tone])}>{children}</span>;
}

export function MarginFigure({ margin }: { margin: number }) {
  const tone = marginTone(margin);
  const width = Math.max(6, Math.min(100, (margin / 0.55) * 100));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1 w-14 bg-muted" aria-hidden>
        <span
          className={cn(
            "block h-full",
            tone === "ok" ? "bg-ok" : tone === "warn" ? "bg-warn" : "bg-late",
          )}
          style={{ width: `${width}%` }}
        />
      </span>
      <span className={cn("font-mono text-xs tabular-nums", toneClass[tone])}>{pct(margin)}</span>
    </span>
  );
}

export function Money({ value }: { value: number }) {
  return <span className="font-mono tabular-nums">{money(value)}</span>;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [note, setNote] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setNote("Copied");
          } catch {
            setNote("Select the text and copy it manually.");
          }
          window.setTimeout(() => setNote(null), 2200);
        }}
      >
        {label}
      </Button>
      {note ? <span className="text-xs text-muted-foreground">{note}</span> : null}
    </div>
  );
}

export function MockupFrame({
  idea,
  swatch,
}: {
  idea: MockupIdea;
  swatch: string;
}) {
  return (
    <figure className="min-w-0">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#f7f7f6]">
        {idea.src ? (
          <Image src={idea.src} alt="" fill sizes="(min-width: 640px) 30vw, 100vw" className="object-cover" />
        ) : null}
        {!idea.src && idea.layout === "line" ? (
          <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 gap-1.5">
            {Array.from({ length: 6 }).map((_, index) => (
              <span
                key={index}
                className="h-10 flex-1"
                style={{ background: swatch, opacity: 0.45 + index * 0.08 }}
              />
            ))}
          </div>
        ) : null}
        {!idea.src && idea.layout === "stack" ? (
          <div className="absolute inset-6 flex flex-col justify-end gap-1.5">
            <span className="h-8 w-2/3" style={{ background: swatch }} />
            <span className="h-3 w-1/2 bg-[#1a1a1a]/15" />
            <span className="h-3 w-1/3 bg-[#1a1a1a]/10" />
          </div>
        ) : null}
        {!idea.src && idea.layout === "pair" ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex items-end gap-3">
              <span className="size-14 rounded-full" style={{ background: swatch }} />
              <span
                className="size-8 rounded-full"
                style={{ background: swatch, opacity: 0.7 }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <figcaption className="mt-2">
        <p className="text-sm font-medium">{idea.title}</p>
        <p className="text-pretty text-xs text-muted-foreground">{idea.direction}</p>
      </figcaption>
    </figure>
  );
}

export function EmptyNote({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-pretty text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
