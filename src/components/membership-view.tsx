"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConnectPayout } from "@/components/connect-payout";
import { PayMembership } from "@/components/pay-membership";
import { Input } from "@/components/ui/input";
import { MEMBER_PRICE, TRIAL_DAYS } from "@/lib/account";
import { useAccount } from "@/lib/account-store";

function AuthenticatorSetup({ enabled, onChanged }: { enabled: boolean; onChanged: () => Promise<void> }) {
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function start() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/account/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "start" }),
    });
    const data = (await response.json().catch(() => null)) as { secret?: string; error?: string } | null;
    setPending(false);
    if (!response.ok || !data?.secret) {
      setError(data?.error ?? "Setup did not start. Try again.");
      return;
    }
    setSecret(data.secret);
  }

  async function confirm(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/account/totp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm", code }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "That code did not match. Try the current code from your app.");
      return;
    }
    setSecret(null);
    await onChanged();
  }

  return (
    <section className="border bg-card p-4">
      <h2 className="text-base font-medium">Authenticator app</h2>
      {enabled ? (
        <p className="mt-2 text-sm leading-relaxed">
          This account asks for a code when you sign in. Admins need this before they can approve a product or release a payout.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Optional for most accounts. If you are an admin, turn this on before you approve a product or release a payout.
            Add the secret to any authenticator app, then enter the 6-digit code.
          </p>
          {secret ? (
            <form onSubmit={confirm} className="mt-3 flex flex-col gap-2">
              <p className="break-all font-mono text-sm">{secret}</p>
              <Input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" required className="h-11" />
              <Button type="submit" disabled={pending} className="h-11 w-fit">
                {pending ? "Checking…" : "Turn on"}
              </Button>
            </form>
          ) : (
            <Button type="button" variant="outline" className="mt-3 h-11" disabled={pending} onClick={() => void start()}>
              Set up authenticator
            </Button>
          )}
        </>
      )}
      {error ? <p className="mt-2 text-sm text-late">{error}</p> : null}
    </section>
  );
}

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
              month. You can use the market and ask the SI Team to work when you sit down. The SI Team will not
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
        <AuthenticatorSetup enabled={account.totpEnabled === true} onChanged={refresh} />
        <ConnectPayout />
        <p className="text-xs text-pretty text-muted-foreground">
          The account is kept on the server. Bank details stay at Stripe.
        </p>
      </div>
    </div>
  );
}
