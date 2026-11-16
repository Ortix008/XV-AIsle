"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { MarkUnderlay } from "@/components/mark-tile";
import { NightMotif } from "@/components/night-motif";
import { Reveal } from "@/components/reveal";
import { aisleCardArt } from "@/lib/art";
import { nightWorlds, nightWorldVars, type NightWorld, type NightWorldSlug } from "@/lib/night-worlds";

const stallArt: Partial<Record<NightWorld["slug"], string>> = aisleCardArt;

function StallFace({ world }: { world: NightWorld }) {
  const art = stallArt[world.slug];
  return (
    <>
      <MarkUnderlay
        src={art}
        sizes="(min-width: 640px) 40vw, 100vw"
        width={1280}
        height={720}
        zoom
        imageClassName={world.slug === "everyday-finds" ? "object-everyday" : undefined}
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

export function NightStalls({ slugs }: { slugs: readonly NightWorldSlug[] }) {
  const stalls = nightWorlds.filter((world) => slugs.includes(world.slug));
  if (stalls.length === 0) return null;
  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {stalls.map((world, index) => {
        const style = nightWorldVars(world) as CSSProperties;
        return (
          <Reveal key={world.slug} as="li" index={index}>
            <Link
              href={`/shop?aisle=${world.slug}`}
              className="aisle-tile aisle-stall flex h-full w-full flex-col rounded-[18px] border p-3.5 text-left"
              style={style}
            >
              <StallFace world={world} />
            </Link>
          </Reveal>
        );
      })}
    </ul>
  );
}
