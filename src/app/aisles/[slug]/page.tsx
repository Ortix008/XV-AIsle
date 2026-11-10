import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AisleDetail } from "@/components/amazon-aisles";
import { ShopFrame } from "@/components/shop-frame";
import { liveAisleBySlug, liveAisles } from "@/lib/amazon-aisles";

export function generateStaticParams() {
  return liveAisles().map((aisle) => ({ slug: aisle.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const aisle = liveAisleBySlug(slug);
  if (!aisle) return {};
  return {
    title: `${aisle.name} · XV-AIsle`,
    description: aisle.intro || undefined,
  };
}

export default async function AislePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const aisle = liveAisleBySlug(slug);
  if (!aisle) notFound();
  return (
    <ShopFrame showStorePayLine={false} showBrandBlock={false}>
      <AisleDetail aisle={aisle} />
    </ShopFrame>
  );
}
