"use client";

import { BrandMark } from "@/components/brand-mark";
import { ConnectPayout } from "@/components/connect-payout";
import { PayMembership } from "@/components/pay-membership";
import { MEMBER_PRICE } from "@/lib/account";
import { useAccount } from "@/lib/account-store";

export { JoinScreen } from "@/components/home-screen";

export function ClosedScreen() {
  const { signOut } = useAccount();
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between bg-[#111] px-4 text-white">
        <BrandMark />
        <button type="button" className="text-xs text-white/70 hover:text-white" onClick={signOut}>
          Sign out
        </button>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto px-5 py-10">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Membership
        </p>
        <h1 className="text-balance text-[1.75rem] leading-tight font-semibold tracking-tight">
          The free month is over.
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          The market stays closed until you keep the account. Membership is ${MEMBER_PRICE} a month
          from here. If you do not continue, the account stays on file and the SI Team stops.
        </p>
        <PayMembership />
        <ConnectPayout />
        <button
          type="button"
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={signOut}
        >
          Leave it closed
        </button>
      </div>
    </div>
  );
}
