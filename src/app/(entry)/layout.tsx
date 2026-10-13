import { Suspense, type ReactNode } from "react";
import { AccountProvider } from "@/lib/account-store";

export default function EntryLayout({ children }: { children: ReactNode }) {
  return (
    <AccountProvider>
      <Suspense
        fallback={
          <div className="grid min-h-dvh place-items-center bg-background px-6 text-base text-muted-foreground">
            Opening the door…
          </div>
        }
      >
        {children}
      </Suspense>
    </AccountProvider>
  );
}
