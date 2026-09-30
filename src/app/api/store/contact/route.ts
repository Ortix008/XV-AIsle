import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { getDb } from "@/lib/server/db";
import { addInquiry, listInquiries } from "@/lib/server/inquiries";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account) return Response.json({ error: "Sign in first." }, { status: 401 });
  const ownsListing = getDb().prepare("SELECT 1 AS ok FROM listings WHERE account_id = ? LIMIT 1").get(account.id) as
    | { ok: number }
    | undefined;
  if (!ownsListing) return Response.json({ inquiries: [] });
  return Response.json({
    inquiries: listInquiries().map((note) => ({
      id: note.id,
      name: note.name,
      email: note.email,
      message: note.message,
      createdAt: note.created_at,
    })),
  });
}

export async function POST(request: Request) {
  if (!allowAttempt(clientBucket(request, "contact"), 5, 15 * 60 * 1000)) {
    return Response.json({ error: "Too many notes. Wait a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: string;
    email?: string;
    message?: string;
  } | null;
  if (!body) return Response.json({ error: "Write a note." }, { status: 400 });
  const result = addInquiry({ name: body.name ?? "", email: body.email ?? "", message: body.message ?? "" });
  if ("error" in result) return Response.json({ error: result.error }, { status: 400 });
  return Response.json({ ok: true });
}
