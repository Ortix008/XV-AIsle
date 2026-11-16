"use client";

import Link from "next/link";
import { MarkUnderlay } from "@/components/mark-tile";
import { Reveal } from "@/components/reveal";
import { departmentHref, floorDepartments, type HomeAisleTile } from "@/lib/department-href";
import { cn } from "cn";

function deskTiles(): HomeAisleTile[] {
  return floorDepartments.flatMap((dept) => {
    const href = departmentHref(dept);
    return href ? [{ title: dept.title, line: dept.line, src: dept.src, href }] : [];
  });
}

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

export function DepartmentGrid({ tiles }: { tiles?: readonly HomeAisleTile[] }) {
  const shown = tiles ?? deskTiles();
  if (shown.length === 0) return null;
  return (
    <ul className="dept-grid grid items-start gap-5 lg:grid-cols-2">
      {shown.map((dept, index) => (
        <Reveal key={`${dept.title}-${dept.href}`} as="li" index={index % 5} className={cn(index === 0 && "lg:row-span-2")}>
          <Link href={dept.href} className="aisle-tile flex w-full flex-col rounded-[18px] border border-border bg-secondary p-3.5 text-left">
            {dept.src ? <DepartmentArt src={dept.src} large={index === 0} /> : null}
            <h3 className="mt-4 px-1.5 text-2xl font-semibold tracking-[-0.02em]">{dept.title}</h3>
            <p className="mt-1 px-1.5 pb-1.5 text-sm text-muted-foreground">{dept.line}</p>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
