import type { Metadata } from "next";
import Link from "next/link";
import { ShopFrame } from "@/components/shop-frame";

export const metadata: Metadata = { title: "Cart · XV-AIsle" };

export default function CartPage() {
  return (
    <ShopFrame>
      <article className="page-read">
        <p className="eyebrow">Cart</p>
        <h1 className="page-title">Nothing is waiting here.</h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
          Your cart is empty for now. We check out one product at a time. Just open a product, add your shipping address,
          and pay right on that page.
        </p>
        <Link href="/shop" className="pill pill-primary mt-8">
          Shop the aisles
        </Link>
      </article>
    </ShopFrame>
  );
}
