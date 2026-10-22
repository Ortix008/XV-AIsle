"use client";

import { useEffect, useState } from "react";
import { ShopFrame } from "@/components/shop-frame";
import { ShopGrid } from "@/components/shop-grid";

type Shop = { id: string; name: string; city: string; makes: string };

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
      <div className="mx-auto max-w-[1280px] px-5 pt-16 sm:px-10">
        <p className="eyebrow">Small business</p>
        <h1 className="mt-4 text-4xl sm:text-5xl">Neighborhood shops</h1>
        <p className="mt-2 max-w-xl text-pretty text-sm text-muted-foreground">
          Every small business here keeps its own name. Bigger national brands have their own list.
        </p>
        {shops === null ? <p className="mt-6 text-sm text-muted-foreground">Opening the shops…</p> : null}
        {shops?.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">No small business is listed yet.</p>
        ) : null}
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {shops?.map((shop) => (
            <li key={shop.id} className="rounded-2xl border border-border bg-card p-5">
              <p className="text-sm font-medium">{shop.name}</p>
              <p className="text-sm text-muted-foreground">{shop.city}</p>
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
