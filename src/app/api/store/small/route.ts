import { listPublicSmallShops } from "@/lib/server/small-shops";

export function GET() {
  return Response.json({ shops: listPublicSmallShops() });
}
