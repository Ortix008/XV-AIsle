import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { listFloorReach, saveFloorReach } from "@/lib/server/floors";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";
import { appOrigin } from "@/lib/server/stripe";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  return Response.json({ origin: appOrigin(), floors: listFloorReach(account.id) });
}

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "floors"), 40, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many updates. Wait a few minutes." }, { status: 429 });
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    floorId?: string;
    status?: string;
    contact?: string;
  } | null;
  if (!body?.floorId || !body.status) return Response.json({ error: "Name the floor." }, { status: 400 });
  const result = saveFloorReach(account.id, {
    floorId: body.floorId,
    status: body.status,
    contact: body.contact ?? "",
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ floor: result.floor, origin: appOrigin() });
}
