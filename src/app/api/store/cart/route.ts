import { personalizedCheckoutBlock } from "@/data/personalized-products";
import { stripeCheckoutBlock } from "@/lib/offer-sale";
import { blockedPublicListing } from "@/lib/public-sale";
import { evaluateStock } from "@/lib/server/inventory";
import { allowClient } from "@/lib/server/rate-limit";
import { getListing } from "@/lib/server/store";

export async function POST(request: Request) {
  if (!allowClient(request, "cart", 30, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many checkout tries. Wait a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    productId?: string;
    variantId?: string;
    qty?: number;
  } | null;
  if (!body?.productId) return Response.json({ error: "Choose a product." }, { status: 400 });
  const offerBlock = stripeCheckoutBlock(body.productId) ?? personalizedCheckoutBlock(body.productId);
  if (offerBlock) return Response.json({ error: offerBlock }, { status: 400 });
  const listing = getListing(body.productId);
  if (blockedPublicListing({ productId: body.productId, ...(listing ?? {}) })) {
    return Response.json({ error: "That page is not on the store." }, { status: 400 });
  }
  const gate = evaluateStock({
    productId: body.productId,
    variantId: typeof body.variantId === "string" ? body.variantId : null,
    qty: body.qty ?? 1,
  });
  if (!gate.ok) return Response.json({ error: gate.error }, { status: 400 });
  return Response.json({ ok: true, qty: gate.qty });
}
