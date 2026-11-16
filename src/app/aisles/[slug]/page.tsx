import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AffiliateSpot } from "@/components/affiliate-spot";
import { AisleDetail } from "@/components/amazon-aisles";
import { ShopFrame } from "@/components/shop-frame";
import { ticketsAisleListed } from "@/config/affiliates";
import { AMAZON_AISLES, liveAisleBySlug, liveAisles } from "@/lib/amazon-aisles";

export function generateStaticParams() {
  return liveAisles().map((aisle) => ({ slug: aisle.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tickets = slug === "tickets-and-events" ? AMAZON_AISLES.find((row) => row.slug === slug) : undefined;
  const aisle = liveAisleBySlug(slug) ?? (tickets && ticketsAisleListed(tickets.items.length) ? tickets : undefined);
  if (!aisle) return {};
  return {
    title: `${aisle.name} · XV-AIsle`,
    description: aisle.intro || undefined,
  };
}

export default async function AislePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "tickets-and-events") {
    const aisle = AMAZON_AISLES.find((row) => row.slug === slug);
    if (!aisle || !ticketsAisleListed(aisle.items.length)) notFound();
    return (
      <ShopFrame showStorePayLine={false} showBrandBlock={false} showAmazonDisclosure={aisle.items.length > 0}>
        <AisleDetail aisle={{ ...aisle, art: undefined }} belowHero={<AffiliateSpot spot="experiences" />} />
      </ShopFrame>
    );
  }
  const aisle = liveAisleBySlug(slug);
  if (!aisle) notFound();
  return (
    <ShopFrame showStorePayLine={false} showBrandBlock={false} showAmazonDisclosure={aisle.items.length > 0}>
      <AisleDetail aisle={aisle} />
    </ShopFrame>
  );
}
