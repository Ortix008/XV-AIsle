"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-store";

export function ConnectPayout() {
  const { account, connect, chooseRole, refresh } = useAccount();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const returned = params.get("connect");

  if (!account) return null;

  async function startOnboarding() {
    setPending("setup");
    setError(null);
    const response = await fetch("/api/connect/onboard", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url) {
      setError(data?.error ?? "Stripe did not open payout setup.");
      setPending(null);
      return;
    }
    window.location.assign(data.url);
  }

  async function openDashboard() {
    setPending("dashboard");
    setError(null);
    const response = await fetch("/api/connect/login", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    setPending(null);
    if (!response.ok || !data?.url) {
      setError(data?.error ?? "Stripe did not open the dashboard.");
      return;
    }
    window.location.assign(data.url);
  }

  async function pick(role: "reseller" | "supplier") {
    setPending(role);
    setError(null);
    const message = await chooseRole(role);
    setPending(null);
    if (message) setError(message);
  }

  const ready = connect?.transfersStatus === "active";

  return (
    <section className="flex max-w-sm flex-col gap-3 border-t pt-4">
      <div>
        <h2 className="text-sm font-medium">Your share</h2>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          Stripe holds the bank account. This market never asks for a card number, a bank number, or a crypto
          address. After a paid order is delivered, Stripe sends the reseller share and the supplier share. The
          platform keeps 8–12%.
        </p>
      </div>
      <p className="text-xs text-muted-foreground">Account id {account.id}</p>
      {returned === "return" ? <p className="text-sm">Stripe sent you back. Payout status is below.</p> : null}
      {returned === "retry" ? (
        <p className="text-sm">The Stripe link expired. Start payout setup again.</p>
      ) : null}
      {account.role === "buyer" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending !== null} onClick={() => void pick("reseller")}>
            {pending === "reseller" ? "Saving…" : "I resell"}
          </Button>
          <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void pick("supplier")}>
            {pending === "supplier" ? "Saving…" : "I supply"}
          </Button>
        </div>
      ) : (
        <p className="text-sm">
          {account.role === "admin" ? "Operator" : account.role === "supplier" ? "Supplier" : "Reseller"}
          {ready ? " · payouts are ready" : connect ? " · Stripe still needs details" : " · payouts are not set up"}
        </p>
      )}
      {connect?.requirementsDue ? (
        <p className="text-pretty text-sm text-muted-foreground">{connect.requirementsDue}</p>
      ) : null}
      {account.role !== "buyer" ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={pending !== null} onClick={() => void startOnboarding()}>
            {pending === "setup" ? "Opening Stripe…" : ready ? "Update payout details" : "Set up payouts"}
          </Button>
          {connect ? (
            <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void openDashboard()}>
              {pending === "dashboard" ? "Opening…" : "Stripe dashboard"}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => {
              void refresh();
            }}
          >
            Refresh status
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-late">{error}</p> : null}
    </section>
  );
}
