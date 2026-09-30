import { appOrigin } from "@/lib/server/stripe";

export function GET() {
  return Response.json({ origin: appOrigin() });
}
