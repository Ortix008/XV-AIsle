import { cookies } from "next/headers";
import { PendingCatalog } from "@/components/pending-catalog";
import { adminWithTotp } from "@/lib/server/access";
import { accountFromToken } from "@/lib/server/accounts";
import { listPendingCatalog } from "@/lib/server/catalog";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export default async function Page() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  const decision = adminWithTotp(account);
  if (decision) {
    return <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">{decision.error}</p>;
  }
  return <PendingCatalog items={listPendingCatalog()} />;
}
