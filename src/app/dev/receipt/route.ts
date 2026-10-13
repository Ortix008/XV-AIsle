import { sampleReceiptHtml } from "@/lib/server/order-mail";

export const dynamic = "force-dynamic";

/** Dev preview of the receipt email. Production requests get nothing to screenshot. */
export function GET() {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  return new Response(sampleReceiptHtml(), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
