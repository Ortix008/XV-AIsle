import { allowClient } from "@/lib/server/rate-limit";
import { savePersonalizedJob } from "@/lib/server/personalized-jobs";
import { PERSONALIZED_CLOSED, approvedDesigns, personalizedPlaceholders } from "@/lib/personalized";

export function GET() {
  return Response.json(
    {
      open: false,
      designs: approvedDesigns,
      options: personalizedPlaceholders,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!allowClient(request, "personalized", 8, 10 * 60 * 1000)) {
    return Response.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { customText?: unknown } | null;
  const customText = typeof body?.customText === "string" ? body.customText : "";
  const saved = savePersonalizedJob({ customText });
  const closed = saved.error === PERSONALIZED_CLOSED;
  return Response.json({ error: saved.error }, { status: closed ? 403 : 400 });
}
