import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { publicListing, resellerListing } from "@/lib/server/order-view";
import { publishForAccount } from "@/lib/server/publish";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { ensureStarterShelf, isSampleListing, visibleOnShop } from "@/lib/server/starter-shelf";
import { listPublished } from "@/lib/server/store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const shelf = url.searchParams.get("shelf");
  const madeInUsa = url.searchParams.get("madeInUsa") === "1";
  ensureStarterShelf();
  const listings = listPublished({
    madeInUsa: madeInUsa || undefined,
    shelf: shelf === "small" || shelf === "national" ? shelf : undefined,
  }).filter(visibleOnShop);
  return Response.json({ listings: listings.map((listing) => publicListing(listing, isSampleListing(listing))) });
}

export async function POST(request: Request) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    sku?: string;
    title?: string;
    description?: string;
    priceCents?: number;
    image?: string;
    supplierName?: string;
    supplierOrigin?: string;
    shipDaysMin?: number;
    shipDaysMax?: number;
    published?: boolean;
    madeInUsa?: boolean;
    shelf?: string;
    catalogItemId?: string;
    feeBps?: number | null;
  } | null;
  if (!body?.productId) return Response.json({ error: "Name the product." }, { status: 400 });
  const result = publishForAccount(account, {
    productId: body.productId,
    sku: body.sku ?? "",
    title: body.title ?? "",
    description: body.description ?? "",
    priceCents: body.priceCents ?? 0,
    image: body.image ?? "",
    supplierName: body.supplierName ?? "Supplier",
    supplierOrigin: body.supplierOrigin ?? "US",
    shipDaysMin: body.shipDaysMin ?? 2,
    shipDaysMax: body.shipDaysMax ?? 5,
    published: body.published !== false,
    madeInUsa: body.madeInUsa === true,
    shelf: body.shelf === "small" ? "small" : "national",
    catalogItemId: body.catalogItemId,
    feeBps: body.feeBps,
  });
  if (result.status !== 200 || !result.listing) {
    const status = result.status === 200 ? 400 : result.status;
    const error = result.status === 200 ? "That page did not save." : result.error;
    return Response.json({ error }, { status });
  }
  return Response.json({ listing: resellerListing(result.listing) });
}
