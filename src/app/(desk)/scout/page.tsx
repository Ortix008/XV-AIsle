import { Suspense } from "react";
import { ScoutView } from "@/components/scout-view";

export default function Page() {
  return (
    <Suspense fallback={<p className="px-6 py-8 text-sm text-muted-foreground">Opening Signal…</p>}>
      <ScoutView />
    </Suspense>
  );
}
