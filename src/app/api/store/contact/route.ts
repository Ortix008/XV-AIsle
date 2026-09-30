import { cookies } from "next/headers";
import { accountFromToken } from "@/lib/server/accounts";
import { addInquiry, inquiriesFor } from "@/lib/server/inquiries";
import { allowAttempt, clientBucket } from "@/lib/server/rate-limit";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const result = inquiriesFor(account);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({
    inquiries: result.inquiries.map((note) => ({
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
