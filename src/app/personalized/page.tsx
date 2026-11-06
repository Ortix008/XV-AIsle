import type { Metadata } from "next";
import Link from "next/link";
import { PersonalizedForm } from "@/components/personalized-form";
import { ShopFrame } from "@/components/shop-frame";
import { PERSONALIZED_CLOSED } from "@/lib/personalized";
import { viewerIsOperator } from "@/lib/server/require-operator";

export const metadata: Metadata = {
  title: "Personalized · XV-AIsle",
  description: "Approved designs and custom lettering. Purchase is closed until materials, price, postage, and turnaround are on file.",
};

export default async function PersonalizedPage() {
  const operator = await viewerIsOperator();
  return (
    <ShopFrame>
      <article className="mx-auto max-w-[1280px] px-5 py-12 sm:px-10">
        <p className="eyebrow">Store</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">Personalized</h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Choose an approved design and the letters to cut. Nothing here is for sale yet.
        </p>
        <p className="mt-3 max-w-xl text-sm font-medium" role="status">
          {PERSONALIZED_CLOSED} Price, postage, and turnaround are not on file.
        </p>
        <PersonalizedForm />
        {operator ? (
          <p className="mt-8 text-sm">
            <Link href="/personalized/jobs" className="tap-link underline underline-offset-4">
              Job tickets
            </Link>
          </p>
        ) : null}
      </article>
    </ShopFrame>
  );
}
