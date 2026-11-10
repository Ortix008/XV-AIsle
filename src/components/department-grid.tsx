"use client";

import Link from "next/link";
import { useState } from "react";
import { AisleView } from "@/components/aisle-view";
import { MarkUnderlay } from "@/components/mark-tile";
import { Reveal } from "@/components/reveal";
import { aisleByTitle } from "@/lib/aisles";
import { welcomeDepartments } from "@/lib/art";
import { nightWorldByTitle } from "@/lib/night-worlds";
import { cn } from "cn";

const floorDepartments = welcomeDepartments.filter(
  (dept) => ("href" in dept && dept.href) || !nightWorldByTitle(dept.title),
);

function DepartmentArt({ src, large }: { src: string; large: boolean }) {
  return (
    <MarkUnderlay
      src={src}
      sizes={large ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 30vw, 100vw"}
      zoom
      className={cn(
        "frame-glow rounded-[14px] border border-border",
        large ? "aspect-[4/5] min-h-72 lg:min-h-[520px] lg:flex-1" : "aspect-[16/10]",
      )}
    />
  );
}

export function DepartmentGrid() {
  const [open, setOpen] = useState<string | null>(null);
  const aisle = open ? aisleByTitle(open) : null;

  return (
    <>
      <ul className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {floorDepartments.map((dept, index) => {
          const href = "href" in dept ? dept.href : "";
          const className = "aisle-tile flex h-full w-full flex-col rounded-[18px] border border-border bg-secondary p-3.5 text-left";
          const art = (
            <>
              <DepartmentArt src={dept.src} large={index === 0} />
              <h3 className="mt-4 px-1.5 text-2xl font-semibold tracking-[-0.02em]">{dept.title}</h3>
              <p className="mt-1 px-1.5 pb-1.5 text-sm text-muted-foreground">{dept.line}</p>
            </>
          );
          return (
            <Reveal key={`${dept.title}-${dept.line}`} as="li" index={index % 5} className={cn(index === 0 && "lg:row-span-2")}>
              {href ? (
                <Link href={href} className={className}>
                  {art}
                </Link>
              ) : (
                <button type="button" className={className} onClick={() => setOpen(dept.title)}>
                  {art}
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
