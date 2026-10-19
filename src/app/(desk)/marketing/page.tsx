import { MarketingView } from "@/components/marketing-view";
import { requireOperator } from "@/lib/server/require-operator";

export default async function Page() {
  await requireOperator();
  return <MarketingView />;
}
