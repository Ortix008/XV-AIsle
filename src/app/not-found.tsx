import Link from "next/link";
import type { CSSProperties } from "react";
import { NightMotif } from "@/components/night-motif";
import { ShopFrame } from "@/components/shop-frame";
import { nightWorlds, nightWorldVars } from "@/lib/night-worlds";

export default function NotFound() {
  return (
    <ShopFrame>
      <section className="lost-aisle">
        <div className="lost-aisle-art" aria-hidden />
        <div className="lost-aisle-copy">
          <p className="eyebrow">404</p>
          <h1 className="page-title">Lost in the aisles</h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            This page is not on the floor. The shop is still open.
          </p>
          <Link href="/shop" className="pill pill-primary mt-8">
            Shop the aisles
          </Link>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:max-w-xl">
            {nightWorlds.map((world) => (
              <li key={world.slug}>
                <Link
                  href={`/shop?aisle=${world.slug}`}
                  data-world={world.slug}
                  style={nightWorldVars(world) as CSSProperties}
                  className="stall-tab"
                >
                  <NightMotif slug={world.slug} />
                  <span className="stall-tab-title">{world.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </ShopFrame>
  );
}
