import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { acceptSupplierDelivery } from "@/lib/server/supplier-callback";

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "supplier-delivery"), 30, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many delivery notes. Wait a few minutes." }, { status: 429 });
  }
  const raw = await request.text();
  const result = await acceptSupplierDelivery(raw, request.headers.get("x-supplier-signature"));
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ order: result.order });
}
