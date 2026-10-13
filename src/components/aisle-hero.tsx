import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "cn";
import { nightWorlds, nightWorldVars } from "@/lib/night-worlds";

export function AisleHero({
  kicker,
  title,
  lede,
  children,
  className,
}: {
  kicker: string;
  title: string;
  lede?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("hero-band", className)}>
      <div className="hero-aisle-stage" aria-hidden>
        <Image
          src="/brand/hero-aisle-pedestals.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-aisle-photo"
        />
        <div className="hero-aisle-grade" />
        <div className="hero-aisle-scrim" />
      </div>
      <div className="relative z-[1] mx-auto flex w-full max-w-[1280px] flex-1 flex-col justify-end px-5 py-12 sm:px-10">
        <div className="hero-glow" aria-hidden />
        <div className="relative z-[1] max-w-2xl">
          <p className="eyebrow hero-eyebrow">{kicker}</p>
          <h1 className="mt-4 text-4xl leading-none font-bold tracking-tight sm:text-5xl">{title}</h1>
          {lede ? <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">{lede}</p> : null}
          {children ? <div className="mt-6 flex flex-wrap gap-3">{children}</div> : null}
        </div>
        <div className="stall-lamps" aria-hidden>
          {nightWorlds.map((world, index) => (
            <span
              key={world.slug}
              className="stall-lamp"
              style={{ ...nightWorldVars(world), animationDelay: `${index * 0.7}s` } as CSSProperties}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
