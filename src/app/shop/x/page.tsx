"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/bits";
import { ShopFrame } from "@/components/shop-frame";
import { xTimelinePost } from "@/lib/floors";
import { money } from "@/lib/money";

type Product = {
  id: string;
  title: string;
  price: string;
  link: string;
  madeInUsa: boolean;
};

type Catalog = {
  domain: string;
  store: string;
  catalog: string;
  checkout: string;
  products: Product[];
};

export default function FromXPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);

  useEffect(() => {
    fetch("/api/store/x-catalog")
      .then((response) => response.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => setCatalog(null));
  }, []);

  return (
    <ShopFrame>
      <article className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">From X</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Sell from a post on X</h1>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-pretty text-muted-foreground">
          <p>
            X can show the product on a post and on a professional profile shop. The buyer taps the link and pays on
            this store. X does not take the card, ship the box, or handle the return.
          </p>
          <p>
            That path is open to a public US professional account with physical goods, a secure checkout, and a contact,
            shipping, and return note on the store. Paste the catalog URL into X Shopping Manager when that account is
            ready. Copy a post when you want the same product in the timeline. Nothing here is sent to X for you.
          </p>
        </div>
        {catalog ? (
          <p className="mt-6 text-sm">
            Catalog for X: <span className="font-medium">{catalog.catalog}</span>
          </p>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">Opening the catalog…</p>
        )}
        <ul className="mt-6 divide-y border-y">
          {catalog?.products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <Link href={`/shop/${product.id}`} className="text-sm font-medium underline underline-offset-4">
                  {product.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {money(Number(product.price))}
                  {product.madeInUsa ? " · Made in the USA" : ""}
                </p>
              </div>
              <CopyButton
                text={xTimelinePost({
                  title: product.title,
                  price: money(Number(product.price)),
                  url: product.link,
                  madeInUsa: product.madeInUsa,
                })}
                label="Copy post"
              />
            </li>
          ))}
        </ul>
        {catalog?.products.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">Mark a page ready and it can be linked from X.</p>
        ) : null}
        <p className="mt-8 text-sm">
          <Link href="/shop/safety" className="underline underline-offset-4">
            Shipping, returns, and contact
          </Link>
        </p>
      </article>
    </ShopFrame>
  );
}
