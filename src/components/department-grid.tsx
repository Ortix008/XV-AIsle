import Link from "next/link";
import { MarkUnderlay } from "@/components/mark-tile";
import { Reveal } from "@/components/reveal";
import { aisleByTitle } from "@/lib/aisles";
import { welcomeDepartments } from "@/lib/art";
import { nightWorldByTitle } from "@/lib/night-worlds";
import { cn } from "cn";

const floorDepartments = welcomeDepartments.filter((dept) => !nightWorldByTitle(dept.title));

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
  const departments = floorDepartments.flatMap((dept) => {
    const aisle = aisleByTitle(dept.title);
    return aisle ? [{ ...dept, slug: aisle.slug }] : [];
  });

  return (
    <ul className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      {departments.map((dept, index) => (
        <Reveal key={dept.title} as="li" index={index % 5} className={cn(index === 0 && "lg:row-span-2")}>
          <Link
            href={`/shop?aisle=${dept.slug}`}
            className="aisle-tile flex h-full w-full flex-col rounded-[18px] border border-border bg-secondary p-3.5 text-left"
          >
            <DepartmentArt src={dept.src} large={index === 0} />
            <h3 className="mt-4 px-1.5 text-2xl font-semibold tracking-[-0.02em]">{dept.title}</h3>
            <p className="mt-1 px-1.5 pb-1.5 text-sm text-muted-foreground">{dept.line}</p>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}
