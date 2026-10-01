import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function ShopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="flex h-14 items-center justify-between bg-[#111] px-4 text-white">
        <Link href="/shop" className="flex items-center">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/shop/safety" className="text-sm text-white/90 hover:text-white">
            How buying works
          </Link>
          <Link href="/" className="text-xs text-white/80 hover:text-white">
            Market desk
          </Link>
        </div>
      </header>
      <nav className="flex gap-4 overflow-x-auto border-b bg-card px-4 py-2 text-sm">
        <Link href="/shop" className="whitespace-nowrap">
          All
        </Link>
        <Link href="/shop/usa" className="whitespace-nowrap">
          Made in the USA
        </Link>
        <Link href="/shop/small" className="whitespace-nowrap">
          Small business
        </Link>
      </nav>
      {children}
    </div>
  );
}
