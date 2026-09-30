"use client";

import Image from "next/image";
import { useState } from "react";
import { AisleView } from "@/components/aisle-view";
import { aisleByTitle } from "@/lib/aisles";
import { welcomeDepartments } from "@/lib/art";

export function DepartmentGrid() {
  const [open, setOpen] = useState<string | null>(null);
  const aisle = open ? aisleByTitle(open) : null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 lg:grid-cols-4">
        {welcomeDepartments.map((dept) => (
          <li key={dept.title} className="bg-card">
            <button
              type="button"
              className="relative block aspect-[4/5] w-full text-left"
              onClick={() => setOpen(dept.title)}
            >
              <Image
                src={dept.src}
                alt=""
                fill
                sizes="(min-width: 1024px) 20vw, 50vw"
                className="object-cover"
              />
              <span className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2.5 text-base font-medium text-white">
                {dept.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {aisle ? <AisleView aisle={aisle} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
