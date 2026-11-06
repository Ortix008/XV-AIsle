import { accountFromToken } from "@/lib/server/accounts";
import { listPersonalizedJobs } from "@/lib/server/personalized-jobs";
import { isOperatorAccount } from "@/lib/server/require-operator";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

function tokenFrom(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function GET(request: Request) {
  const account = accountFromToken(tokenFrom(request));
  if (!isOperatorAccount(account)) {
    return Response.json({ error: "Sign in as a verified operator." }, { status: 403 });
  }
  return Response.json({ jobs: listPersonalizedJobs() }, { headers: { "Cache-Control": "no-store" } });
}
