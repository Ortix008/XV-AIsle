"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConnectPayout } from "@/components/connect-payout";
import { PayMembership } from "@/components/pay-membership";
import { MEMBER_PRICE, TRIAL_DAYS } from "@/lib/account";
import { useAccount } from "@/lib/account-store";

export function MembershipView() {
  const { account, status, daysLeft, stopMembership, refresh } = useAccount();
  const params = useSearchParams();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    const sessionId = params.get("session_id");
    if (params.get("checkout") !== "return" || !sessionId) return;
    let cancel = false;
    fetch("/api/billing/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { error?: string; kind?: string } | null;
        if (cancel) return;
        setConfirm(response.ok && data?.kind === "membership" ? "Membership is active." : data?.error ?? "Payment was not confirmed.");
        await refresh();
      })
      .catch(() => {
        if (!cancel) setConfirm("Payment was not confirmed.");
      });
    return () => {
      cancel = true;
    };
  }, [params, refresh]);

  if (!account || !status) return null;

  return (
    <div className="lg:h-full lg:overflow-y-auto lg:overscroll-y-contain">
      <div className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-6 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Membership
        </p>
        <h1 className="text-balance text-[1.75rem] leading-tight font-semibold tracking-tight">
          {status === "member" ? "You are keeping the account." : "Your free month is open."}
        </h1>
        {confirm ? <p className="text-sm">{confirm}</p> : null}
        {status === "trial" ? (
          <>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              {daysLeft === 1 ? "1 day left" : `${daysLeft} days left`} of the {TRIAL_DAYS}-day
              month. You can use the market and run a pass when you sit down. The SI Team will not
              stay on until you keep the account.
            </p>
            <p className="text-sm">
              After that, membership is ${MEMBER_PRICE} a month, charged through Stripe. If you do
              not continue, the market stops.
            </p>
            <PayMembership />
          </>
        ) : (
          <>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              ${MEMBER_PRICE} a month. The SI Team can stay on. You can stop whenever you want.
              Stopping closes the market if the free month has already passed.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              disabled={stopping}
              onClick={() => {
                setStopping(true);
                void stopMembership().finally(() => setStopping(false));
              }}
            >
              {stopping ? "Stopping…" : "Stop membership"}
            </Button>
          </>
        )}
        <ConnectPayout />
        <p className="text-xs text-pretty text-muted-foreground">
          The account is kept on the server. Bank details stay at Stripe.
        </p>
      </div>
    </div>
  );
}
