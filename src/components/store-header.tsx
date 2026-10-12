import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

const nav = [
  { href: "/shop", label: "Shop" },
  { href: "/shop/usa", label: "Made in the USA" },
  { href: "/shop/small", label: "Small business" },
  { href: "/#aisles", label: "Aisles" },
];

export function StoreHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[#07080a]/90 backdrop-blur-[14px]">
      <div className="mx-auto flex h-[68px] max-w-[1280px] items-center justify-between gap-4 px-5 sm:px-10">
        <Link href="/" className="min-w-0">
          <BrandMark />
        </Link>
        <nav className="hidden items-center gap-[30px] text-sm text-muted-foreground min-[900px]:flex" aria-label="Shop">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/shop" className="hover:text-foreground">
            Search
          </Link>
          <Link href="/#account" className="hidden hover:text-foreground min-[900px]:inline">
            Account
          </Link>
          <Link
            href="/shop/cart"
            className="rounded-full border border-border px-3.5 py-1.5 text-foreground transition hover:border-transparent hover:shadow-[var(--glow)]"
          >
            Cart
          </Link>
        </div>
      </div>
      <nav
        className="flex gap-5 overflow-x-auto px-5 pb-3 text-sm text-muted-foreground min-[900px]:hidden"
        aria-label="Shop"
      >
        {nav.map((item) => (
          <Link key={item.href} href={item.href} className="shrink-0 hover:text-foreground">
            {item.label}
          </Link>
        ))}
        <Link href="/#account" className="shrink-0 hover:text-foreground">
          Account
        </Link>
      </nav>
    </header>
  );
}
