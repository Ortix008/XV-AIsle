import { ListingsView } from "@/components/listings-view";
import { requireOperator } from "@/lib/server/require-operator";
import { appOrigin } from "@/lib/server/stripe";

export const dynamic = "force-dynamic";

export default async function Page() {
  await requireOperator();
  return <ListingsView shareOrigin={appOrigin()} />;
}
