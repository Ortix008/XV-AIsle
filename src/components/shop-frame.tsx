import type { ReactNode } from "react";
import { ShopFooter } from "@/components/shop-footer";
import { StoreHeader } from "@/components/store-header";

export function ShopFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#store-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <StoreHeader />
      <main id="store-main" className="page-enter flex-1">
        {children}
      </main>
      <ShopFooter />
    </div>
  );
}
