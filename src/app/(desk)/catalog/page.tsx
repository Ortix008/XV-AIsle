import { PendingCatalog } from "@/components/pending-catalog";
import { adminWithTotp } from "@/lib/server/access";
import { listPendingCatalog } from "@/lib/server/catalog";
import { requireOperator } from "@/lib/server/require-operator";

export default async function Page() {
  const account = await requireOperator();
  const decision = adminWithTotp(account);
  if (decision) {
    return <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">{decision.error}</p>;
  }
  return <PendingCatalog items={listPendingCatalog()} />;
}
