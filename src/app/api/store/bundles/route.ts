import { cookies } from "next/headers";
import { verifiedAdmin } from "@/lib/server/access";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { listPublished, publishBundle } from "@/lib/server/store";

async function operator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const denied = verifiedAdmin(account);
  if (denied || !account) return { error: Response.json({ error: denied?.error ?? "Sign in first." }, { status: denied?.status ?? 401 }) };
  return { account };
}

export async function GET() {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const listings = listPublished()
    .filter((listing) => listing.kind !== "bundle")
    .map((listing) => ({
      productId: listing.productId,
      title: listing.title,
      supplierName: listing.supplierName,
      supplierOrigin: listing.supplierOrigin,
      priceCents: listing.priceCents,
      shipDaysMax: listing.shipDaysMax,
    }));
  return Response.json({ listings });
}

export async function POST(request: Request) {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    sku?: string;
    title?: string;
    description?: string;
    priceCents?: number;
    image?: string;
    itemIds?: string[];
    aisle?: string;
  } | null;
  if (!body?.productId || !Array.isArray(body.itemIds)) {
    return Response.json({ error: "Name the bundle and the listings in it." }, { status: 400 });
  }
  const saved = publishBundle(gate.account, {
    productId: body.productId,
    sku: body.sku ?? "",
    title: body.title ?? "",
    description: body.description ?? "",
    priceCents: body.priceCents ?? 0,
    image: body.image ?? "",
    itemIds: body.itemIds.filter((id): id is string => typeof id === "string"),
    aisle: typeof body.aisle === "string" ? body.aisle : undefined,
  });
  if ("error" in saved) return Response.json({ error: saved.error }, { status: 400 });
  return Response.json({
    productId: saved.listing?.productId,
    priceCents: saved.listing?.priceCents,
    kind: saved.listing?.kind,
  });
}
