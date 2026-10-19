import { FloorView } from "@/components/floor-view";
import { requireOperator } from "@/lib/server/require-operator";

export default async function DeskPage() {
  await requireOperator();
  return <FloorView />;
}
