import { buyerOrder } from "@/lib/server/order-view";
import { allowClient } from "@/lib/server/rate-limit";
import { acceptSupplierDelivery } from "@/lib/server/supplier-callback";
import { authorizeSupplierWebhook, SUPPLIER_SIGNATURE_HEADER } from "@/lib/server/supplier-webhook";

export async function POST(request: Request) {
  if (!allowClient(request, "supplier-delivery", 30, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many delivery notes. Wait a few minutes." }, { status: 429 });
  }
  const raw = await request.text();
  // Origin is exempt. The HMAC and the per-account x-supplier-secret authenticate the callback.
  const auth = authorizeSupplierWebhook(raw, request.headers.get(SUPPLIER_SIGNATURE_HEADER));
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status });
  const result = await acceptSupplierDelivery(raw, request.headers.get("x-supplier-secret"));
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ order: result.order ? buyerOrder(result.order) : null });
}
