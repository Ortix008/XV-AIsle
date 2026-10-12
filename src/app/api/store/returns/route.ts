import { cookies } from "next/headers";
import { verifiedAdmin } from "@/lib/server/access";
import { accountFromToken } from "@/lib/server/accounts";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { listSupplierReturns, saveSupplierReturn } from "@/lib/server/supplier-returns";

async function operator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const denied = verifiedAdmin(account);
  if (denied) return { error: Response.json({ error: denied.error }, { status: denied.status }) };
  return { account };
}

export async function GET() {
  const gate = await operator();
  if ("error" in gate) return gate.error;
  return Response.json({ suppliers: listSupplierReturns() });
}

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "supplier-returns"), 30, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }
  const gate = await operator();
  if ("error" in gate) return gate.error;
  const body = (await request.json().catch(() => null)) as {
    supplierKey?: string;
    line1?: string;
    city?: string;
    region?: string;
    postal?: string;
    country?: string;
  } | null;
  if (!body?.supplierKey) return Response.json({ error: "Choose a supplier." }, { status: 400 });
  const saved = saveSupplierReturn(gate.account, body.supplierKey, body);
  if ("error" in saved) return Response.json({ error: saved.error }, { status: saved.status });
  return Response.json({ suppliers: listSupplierReturns() });
}
