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
          This shop checks out one product at a time. Open a product, enter the shipping address, and pay on that page.
          Stripe handles the card. We never see the card number.
        </p>
        <Link href="/shop" className="pill pill-primary mt-8">
          Shop the aisles
        </Link>
      </article>
    </ShopFrame>
  );
}
