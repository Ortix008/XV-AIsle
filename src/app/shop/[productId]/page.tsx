import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { AislePicks, type AislePick } from "@/components/aisle-picks";
import { ProductBuy } from "@/components/product-buy";
import { ShopFrame } from "@/components/shop-frame";
import { money } from "@/lib/money";
import { productShipLine, usSupplierConfirmed } from "@/lib/order-facts";
import { accountFromToken } from "@/lib/server/accounts";
import { publicListing } from "@/lib/server/order-view";
import { isOperatorAccount } from "@/lib/server/require-operator";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { ensureStarterShelf, isSampleListing, listedOnGrid, sampleProductReturnNote, visibleOnShop } from "@/lib/server/starter-shelf";
import { isHeldSample } from "@/lib/shelf-holds";
import { requireSupplierConfirmed } from "@/lib/supplier-confirm";
import { returnCopyForListing } from "@/lib/server/supplier-returns";
import { getListing, listPublished, listingLoss } from "@/lib/server/store";
import { publicSiteUrl } from "@/lib/config/env";
import { productOgImage } from "@/lib/product-og";
import { buyerShareHref, resellerShareHref } from "@/lib/x-share";

export const dynamic = "force-dynamic";

function aisleKey(listing: { kind: string; aisle: string | null }) {
  if (listing.kind === "bundle") return "bundles";
  return listing.aisle;
}

export async function generateMetadata({ params }: { params: Promise<{ productId: string }> }): Promise<Metadata> {
  const { productId } = await params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) return { title: "Shop · XV-AIsle" };
  const shown = publicListing(listing, isSampleListing(listing));
  const origin = publicSiteUrl();
  const canonical = `${origin}/shop/${listing.productId}`;
  const description = `${money(listing.priceCents / 100)}. ${shown.description}`.slice(0, 200);
  const image = productOgImage(origin, listing.image, shown.title);
  return {
    title: `${shown.title} · XV-AIsle`,
    description,
    alternates: { canonical },
    openGraph: { title: shown.title, description, url: canonical, images: [image] },
    twitter: {
      card: "summary_large_image",
      site: "@xvaisle",
      title: shown.title,
      description,
      images: [image.url],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  ensureStarterShelf();
  const listing = getListing(productId);
  if (!listing || !visibleOnShop(listing) || listingLoss(listing)) notFound();
  const aisle = aisleKey(listing);
  const picks: AislePick[] = aisle
    ? listPublished({ aisle })
        .filter((item) => item.productId !== listing.productId && listedOnGrid(item))
        .slice(0, 4)
        .map((item) => ({
          productId: item.productId,
          title: publicListing(item, isSampleListing(item)).title,
          priceCents: item.priceCents,
          image: item.image,
          aisle: item.aisle,
          kind: item.kind === "bundle" ? "bundle" : undefined,
        }))
    : [];
  const origin = publicSiteUrl();
  const productUrl = `${origin}/shop/${listing.productId}`;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const shareHref =
    account?.role === "reseller"
      ? resellerShareHref({ title: listing.title, productUrl, accountId: account.id })
      : buyerShareHref({ title: listing.title, productUrl });
  const operator = isOperatorAccount(account);
  const held = isHeldSample(listing);
  return (
    <ShopFrame>
      <ProductBuy
        listing={publicListing(listing, isSampleListing(listing))}
        returnNote={sampleProductReturnNote(listing, returnCopyForListing(listing))}
        shareHref={shareHref}
        held={held}
        unconfirmed={!held && requireSupplierConfirmed() && listing.supplierUsConfirmed !== true}
        showReturnAddress={operator}
        nameUsSupplier={usSupplierConfirmed(listing)}
        shipWindow={productShipLine(listing)}
      />
      <AislePicks aisle={aisle} picks={picks} />
    </ShopFrame>
  );
}
