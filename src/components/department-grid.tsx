"use client";

import Link from "next/link";
import { MarkUnderlay } from "@/components/mark-tile";
import { Reveal } from "@/components/reveal";
import { liveAisleBySlug } from "@/lib/amazon-aisles";
import { aisleByTitle } from "@/lib/aisles";
import { welcomeDepartments } from "@/lib/art";
import { nightWorldByTitle } from "@/lib/night-worlds";
import { cn } from "cn";

const floorDepartments = welcomeDepartments.filter(
  (dept) => ("href" in dept && dept.href) || !nightWorldByTitle(dept.title),
);

export function departmentHref(dept: (typeof floorDepartments)[number]) {
  if ("href" in dept && dept.href) {
    if (dept.href.includes("aisle=bundles")) return "";
    return dept.href;
  }
  const aisle = aisleByTitle(dept.title);
  if (!aisle) return "";
  if (liveAisleBySlug(aisle.slug)) return `/aisles/${aisle.slug}`;
  return `/shop?aisle=${aisle.slug}`;
}

const linkedDepartments = floorDepartments.flatMap((dept) => {
  const href = departmentHref(dept);
  return href ? [{ dept, href }] : [];
});

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
  return (
    <ul className="dept-grid grid items-start gap-5 lg:grid-cols-2">
      {linkedDepartments.map(({ dept, href }, index) => (
        <Reveal key={`${dept.title}-${dept.line}`} as="li" index={index % 5} className={cn(index === 0 && "lg:row-span-2")}>
          <Link href={href} className="aisle-tile flex w-full flex-col rounded-[18px] border border-border bg-secondary p-3.5 text-left">
            <DepartmentArt src={dept.src} large={index === 0} />
            <h3 className="mt-4 px-1.5 text-2xl font-semibold tracking-[-0.02em]">{dept.title}</h3>
            <p className="mt-1 px-1.5 pb-1.5 text-sm text-muted-foreground">{dept.line}</p>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
