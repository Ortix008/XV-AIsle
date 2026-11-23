import { connection } from "next/server";
import { JoinScreen } from "@/components/home-screen";
import type { ShopCard } from "@/components/shop-grid";
import { checkoutOpenLine } from "@/lib/checkout-open";
import { AccountProvider } from "@/lib/account-store";
import { showShopPrices } from "@/lib/shop-prices";
import { homepageNightSlugs, showHomeAisles, showHomeBuying } from "@/lib/home-aisles";
import { publicGridListings } from "@/lib/server/shop-catalog";
import { viewerIsOperator } from "@/lib/server/require-operator";
import { stripeTestMode } from "@/lib/server/stripe";

const HERO_POSTER = "/brand/hero-aisle-pedestals.webp";
const HERO_BAND_AVIF = "/brand/hero-band-640.avif 640w, /brand/hero-band-983.avif 983w";

export default async function Page() {
  await connection();
  const buying = showHomeBuying();
  const checkoutLine = buying ? checkoutOpenLine(stripeTestMode()) : "";
  const operator = await viewerIsOperator();
  const listings = publicGridListings() as ShopCard[];
  const nightsOn = showHomeAisles();
  return (
    <>
      <link
        rel="preload"
        as="image"
        type="image/avif"
        media="(max-width: 767px)"
        href="/brand/hero-band-640.avif"
        imageSrcSet={HERO_BAND_AVIF}
        imageSizes="125vw"
        fetchPriority="high"
      />
      <link rel="preload" as="image" href={HERO_POSTER} media="(min-width: 768px)" fetchPriority="high" />
      <AccountProvider>
        <JoinScreen
          checkoutLine={checkoutLine}
          showBuying={buying}
          operator={operator}
          showPrices={showShopPrices()}
          listings={listings}
          nightSlugs={nightsOn ? homepageNightSlugs(listings) : []}
        />
      </AccountProvider>
    </>
  );
}
