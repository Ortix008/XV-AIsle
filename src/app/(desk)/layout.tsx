import { Suspense, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DeskShell } from "@/components/desk-shell";
import { AccountProvider } from "@/lib/account-store";
import { DeskProvider } from "@/lib/desk-store";

export default function DeskLayout({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      <AccountProvider>
        <DeskProvider>
          <Suspense
            fallback={
              <div className="grid h-dvh place-items-center bg-background px-6 text-sm text-muted-foreground">
                Opening the market…
              </div>
            }
          >
            <DeskShell>{children}</DeskShell>
          </Suspense>
        </DeskProvider>
      </AccountProvider>
    </TooltipProvider>
  );
}
