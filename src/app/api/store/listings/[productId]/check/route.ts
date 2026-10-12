import { cookies } from "next/headers";
import { verifiedAdmin } from "@/lib/server/access";
import { accountFromToken } from "@/lib/server/accounts";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { getListing, saveListingCheck } from "@/lib/server/store";

async function operator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const denied = verifiedAdmin(account);
  if (denied) return { error: Response.json({ error: denied.error }, { status: denied.status }) };
  return { account };
}

export async function GET(_request: Request, context: { params: Promise<{ productId: string }> }) {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const { productId } = await context.params;
  const listing = getListing(productId);
  if (!listing) return Response.json({ error: "That page is not on the store." }, { status: 404 });
  return Response.json({
    checkedBy: listing.checkedBy ?? "",
    checkedOn: listing.checkedOn ?? "",
    checkedNote: listing.checkedNote ?? "",
  });
}

export async function POST(request: Request, context: { params: Promise<{ productId: string }> }) {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const { productId } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    checkedBy?: string;
    checkedOn?: string;
    checkedNote?: string;
  } | null;
  if (!body) return Response.json({ error: "Send the check." }, { status: 400 });
  const saved = saveListingCheck(productId, {
    checkedBy: body.checkedBy ?? "",
    checkedOn: body.checkedOn ?? "",
    checkedNote: body.checkedNote ?? "",
  });
  if ("error" in saved) return Response.json({ error: saved.error }, { status: 400 });
  return Response.json({
    checkedBy: saved.listing?.checkedBy ?? "",
    checkedOn: saved.listing?.checkedOn ?? "",
    checkedNote: saved.listing?.checkedNote ?? "",
  });
}
