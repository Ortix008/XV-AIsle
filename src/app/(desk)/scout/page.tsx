import { Suspense } from "react";
import { ScoutView } from "@/components/scout-view";
import { requireOperator } from "@/lib/server/require-operator";

export default async function Page() {
  await requireOperator();
  return (
    <Suspense fallback={<p className="px-6 py-8 text-sm text-muted-foreground">Opening Signal…</p>}>
      <ScoutView />
    </Suspense>
  );
}
