"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isStripeRedirectUrl } from "@/lib/checkout-url";
import { useAccount } from "@/lib/account-store";

function reserveMoney(cents: number) {
  const dollars = cents / 100;
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`;
}

function reservePercent(bps: number) {
  return bps % 100 === 0 ? String(bps / 100) : (bps / 100).toFixed(2);
}

export function ConnectPayout() {
  const { account, connect, reserve, chooseRole, refresh } = useAccount();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [costCents, setCostCents] = useState("");
  const [shippingCents, setShippingCents] = useState("");
  const [origin, setOrigin] = useState("");
  const returned = params.get("connect");

  if (!account) return null;

  async function startOnboarding() {
    setPending("setup");
    setError(null);
    const response = await fetch("/api/connect/onboard", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url || !isStripeRedirectUrl(data.url)) {
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
    if (!response.ok || !data?.url || !isStripeRedirectUrl(data.url)) {
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

  async function rotateSecret() {
    setPending("secret");
    setError(null);
    const response = await fetch("/api/supplier/secret", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { secret?: string; error?: string } | null;
    setPending(null);
    if (!response.ok || !data?.secret) {
      setError(data?.error ?? "The delivery secret was not created.");
      return;
    }
    setSecret(data.secret);
  }

  async function addCatalog(event: React.FormEvent) {
    event.preventDefault();
    setPending("catalog");
    setError(null);
    const response = await fetch("/api/supplier/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku,
        title,
        costCents: Number(costCents),
        shippingCents: Number(shippingCents || "0"),
        origin,
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(null);
    if (!response.ok) {
      setError(data?.error ?? "The catalog item was not saved.");
      return;
    }
    setSku("");
    setTitle("");
    setCostCents("");
    setShippingCents("");
  }

  const ready = connect?.transfersStatus === "active";

  return (
    <section className="flex max-w-sm flex-col gap-3 border-t pt-4">
      <div>
        <h2 className="text-sm font-medium">Your share</h2>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          Stripe holds the bank account. This market never asks for a card number, a bank number, or a crypto
          address. After the buyer confirms delivery, or 7 days pass with no dispute, Stripe sends the reseller
          share and the supplier share. The platform keeps 8–12%. We hold {reserve ? reservePercent(reserve.bps) : "10"}%
          of each payout, up to {reserve ? reserveMoney(reserve.capCents) : "$100"} total, for{" "}
          {reserve ? reserve.days : 120} days to cover refunds and disputes, then release it to you automatically.
        </p>
      </div>
      {account.role === "reseller" && reserve ? (
        <div className="text-sm">
          <p>Reserve held {reserveMoney(reserve.heldCents)}</p>
          {reserve.releases.length === 0 ? (
            <p className="mt-1 text-muted-foreground">No reserve is held right now.</p>
          ) : (
            <ul className="mt-1 flex flex-col gap-1 text-muted-foreground">
              {reserve.releases.map((item) => (
                <li key={item.orderId}>
                  {reserveMoney(item.amountCents)}
                  {item.blocked || item.releaseAt == null
                    ? " stays held because this order was refunded or disputed."
                    : ` releases ${new Date(item.releaseAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
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
      {account.role === "supplier" ? (
        <div className="flex flex-col gap-2">
          <Button type="button" variant="outline" disabled={pending !== null} onClick={() => void rotateSecret()}>
            {pending === "secret" ? "Saving…" : "New delivery secret"}
          </Button>
          {secret ? (
            <p className="break-all text-xs">
              Copy this secret now. It is stored hashed and will not be shown again. {secret}
            </p>
          ) : null}
          <form className="flex flex-col gap-2" onSubmit={(event) => void addCatalog(event)}>
            <p className="text-sm">Catalog price</p>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title" required />
            <Input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="SKU" required />
            <Input
              value={costCents}
              onChange={(event) => setCostCents(event.target.value)}
              inputMode="numeric"
              placeholder="Unit cost in cents"
              required
            />
            <Input
              value={shippingCents}
              onChange={(event) => setShippingCents(event.target.value)}
              inputMode="numeric"
              placeholder="Shipping cents, once per order"
            />
            <Input value={origin} onChange={(event) => setOrigin(event.target.value)} placeholder="Ships from" required />
            <Button type="submit" variant="outline" disabled={pending !== null}>
              {pending === "catalog" ? "Saving…" : "Approve this price"}
            </Button>
          </form>
        </div>
      ) : null}
      {error ? <p className="text-sm text-late">{error}</p> : null}
    </section>
  );
}
