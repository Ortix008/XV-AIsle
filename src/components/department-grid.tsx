"use client";

import Image from "next/image";
import { useState } from "react";
import { AisleView } from "@/components/aisle-view";
import { aisleByTitle } from "@/lib/aisles";
import { welcomeDepartments } from "@/lib/art";
import { cn } from "cn";

export function DepartmentGrid() {
  const [open, setOpen] = useState<string | null>(null);
  const aisle = open ? aisleByTitle(open) : null;

  return (
    <>
      <ul className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {welcomeDepartments.map((dept, index) => (
          <li key={dept.title} className={cn("reveal", index === 0 && "lg:row-span-2")}>
            <button
              type="button"
              className="store-card flex h-full w-full flex-col rounded-[18px] border border-border bg-secondary p-3.5 text-left"
              onClick={() => setOpen(dept.title)}
            >
              <div
                className={cn(
                  "media-well relative overflow-hidden rounded-[14px] border border-border",
                  index === 0 ? "aspect-[4/5] min-h-72 lg:min-h-[520px] lg:flex-1" : "aspect-[16/10]",
                )}
              >
                <Image
                  src={dept.src}
                  alt=""
                  fill
                  sizes={index === 0 ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 30vw, 100vw"}
                  className="media-zoom object-cover"
                />
              </div>
              <h3 className="mt-4 px-1.5 text-2xl font-semibold tracking-[-0.02em]">{dept.title}</h3>
              <p className="mt-1 px-1.5 pb-1.5 text-sm text-muted-foreground">{dept.line}</p>
            </button>
          </li>
        ))}
      </ul>
      {aisle ? <AisleView aisle={aisle} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
