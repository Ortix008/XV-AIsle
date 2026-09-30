"use client";

import { useEffect, useState } from "react";
import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid } from "@/components/shop-grid";

type Shop = { id: string; name: string; city: string; makes: string; madeInUsa: boolean };

export default function SmallBusinessPage() {
  const [shops, setShops] = useState<Shop[] | null>(null);

  useEffect(() => {
    fetch("/api/store/small")
      .then((response) => response.json())
      .then((data: { shops: Shop[] }) => setShops(data.shops ?? []))
      .catch(() => setShops([]));
  }, []);

  return (
    <ShopFrame>
      <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Small business</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Neighborhood shops</h1>
        <p className="mt-2 max-w-xl text-pretty text-sm text-muted-foreground">
          A small business keeps its own name on the store. National floors are a different list. If they make the goods
          in the USA, the page says so.
        </p>
        {shops === null ? <p className="mt-6 text-sm text-muted-foreground">Opening the shops…</p> : null}
        {shops?.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No small business is listed yet.</p>
        ) : null}
        <ul className="mt-6 divide-y border-y">
          {shops?.map((shop) => (
            <li key={shop.id} className="py-3">
              <p className="text-sm font-medium">{shop.name}</p>
              <p className="text-sm text-muted-foreground">
                {shop.city}
                {shop.madeInUsa ? " · Makes goods in the USA" : ""}
              </p>
              <p className="mt-1 text-sm">{shop.makes}</p>
            </li>
          ))}
        </ul>
      </div>
      <ShopGrid
        kicker="Their pages"
        title="Ready from a small business"
        lede="These are the pages a small business has marked ready."
        query="?shelf=small"
        empty="No small-business page is ready yet."
      />
    </ShopFrame>
  );
}
