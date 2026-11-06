import { publicSourcedOffers } from "@/lib/server/offer-guard";

export function GET() {
  return Response.json({ offers: publicSourcedOffers() }, { headers: { "Cache-Control": "no-store" } });
}
