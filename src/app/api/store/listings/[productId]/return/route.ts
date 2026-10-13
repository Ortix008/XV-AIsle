import { cookies } from "next/headers";
import { verifiedAdmin } from "@/lib/server/access";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { getListing } from "@/lib/server/store";
import { saveProductReturn } from "@/lib/server/supplier-returns";

async function operator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const denied = verifiedAdmin(account);
  if (denied) return { error: Response.json({ error: denied.error }, { status: denied.status }) };
  return { account };
}

function fields(productId: string) {
  const listing = getListing(productId);
  if (!listing) return null;
  return {
    line1: listing.returnLine1 ?? "",
    city: listing.returnCity ?? "",
    region: listing.returnRegion ?? "",
    postal: listing.returnPostal ?? "",
    country: listing.returnCountry ?? "",
  };
}

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const { productId } = await context.params;
  const address = fields(productId);
  if (!address) return Response.json({ error: "That page is not on the store." }, { status: 404 });
  return Response.json(address);
}

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const { productId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    line1?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  } | null;
  if (!body) return Response.json({ error: "Send the return address." }, { status: 400 });
  const saved = saveProductReturn(gate.account, productId, body);
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json(fields(productId));
}
