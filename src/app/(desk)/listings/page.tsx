import { ListingsView } from "@/components/listings-view";
import { publicSiteUrl } from "@/lib/config/env";
import { requireOperator } from "@/lib/server/require-operator";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireOperator();
  return <ListingsView shareOrigin={publicSiteUrl()} />;
}
