"use client";

import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { AisleView } from "@/components/aisle-view";
import { MarkUnderlay } from "@/components/mark-tile";
import { NightMotif } from "@/components/night-motif";
import { Reveal } from "@/components/reveal";
import { aisleByTitle } from "@/lib/aisles";
import { nightWorlds, nightWorldVars, type NightWorld } from "@/lib/night-worlds";
import { cn } from "cn";
import { aisleCardArt } from "@/lib/art";

const stallArt: Partial<Record<NightWorld["slug"], string>> = aisleCardArt;

function StallFace({ world }: { world: NightWorld }) {
  const art = stallArt[world.slug];
  return (
    <>
      <MarkUnderlay
        src={art}
        sizes="(min-width: 640px) 40vw, 100vw"
        zoom
        className="night-well rounded-[14px] border border-border"
      >
        {art ? (
          <span className="night-badge">
            <NightMotif slug={world.slug} />
          </span>
        ) : (
          <div className="night-motif-well">
            <NightMotif slug={world.slug} />
          </div>
        )}
      </MarkUnderlay>
      <h3 className="mt-4 px-1.5 text-2xl font-semibold tracking-[-0.02em]">{world.title}</h3>
      <p className="mt-1 px-1.5 pb-1.5 text-sm leading-relaxed text-muted-foreground">{world.story}</p>
    </>
  );
}

export function NightStalls() {
  const [open, setOpen] = useState<string | null>(null);
  const aisle = open ? aisleByTitle(open) : null;

  return (
    <>
      <ul className="grid gap-5 sm:grid-cols-2">
        {nightWorlds.map((world, index) => {
          const style = nightWorldVars(world) as CSSProperties;
          const className = "aisle-tile aisle-stall flex h-full w-full flex-col rounded-[18px] border p-3.5 text-left";
          return (
            <Reveal key={world.slug} as="li" index={index}>
              {world.slug === "bundles" ? (
                <Link href="/shop?aisle=bundles" className={className} style={style}>
                  <StallFace world={world} />
                </Link>
              ) : (
                <button type="button" className={cn(className)} style={style} onClick={() => setOpen(world.title)}>
                  <StallFace world={world} />
                </button>
              )}
            </Reveal>
          );
        })}
      </ul>
      {aisle ? <AisleView aisle={aisle} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
