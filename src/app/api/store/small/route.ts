import { listSmallShops, publicSmallShop } from "@/lib/server/small-shops";

export function GET() {
  return Response.json({ shops: listSmallShops().map(publicSmallShop) });
}
