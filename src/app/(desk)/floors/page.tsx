import { FloorsView } from "@/components/floors-view";
import { requireOperator } from "@/lib/server/require-operator";

export default async function FloorsPage() {
  await requireOperator();
  return <FloorsView />;
}
