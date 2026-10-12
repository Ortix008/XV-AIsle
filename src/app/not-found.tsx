import Link from "next/link";
import { ShopFrame } from "@/components/shop-frame";

export default function NotFound() {
  return (
    <ShopFrame>
      <article className="page-read">
        <p className="eyebrow">404</p>
        <h1 className="page-title">This page is not on the floor.</h1>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
          The link does not match a product, an aisle, or a policy. The shop is still open.
        </p>
        <Link href="/shop" className="pill pill-primary mt-8">
          Shop the aisles
        </Link>
      </article>
    </ShopFrame>
  );
}
