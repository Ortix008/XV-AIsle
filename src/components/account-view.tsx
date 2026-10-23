"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConnectPayout } from "@/components/connect-payout";
import { Input } from "@/components/ui/input";
import { AuthPane } from "@/components/auth-backdrop";
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
    <section id="authenticator" className="auth-subcard">
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

function ReceiptEmail() {
  const { account, refresh } = useAccount();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  if (!account?.needsEmail) return null;

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/account/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "That email did not save.");
      return;
    }
    setSent(true);
    await refresh();
  }

  return (
    <form onSubmit={save} className="auth-subcard">
      <h2 className="text-base font-medium">Email for receipts</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {"X doesn't share your email with us. Add one here so we can send your receipts."}
      </p>
      <label className="mt-3 flex flex-col gap-1 text-base">
        Email
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          maxLength={120}
          required
          className="h-11"
        />
      </label>
      <Button type="submit" disabled={pending} className="mt-3 h-11">
        {pending ? "Saving…" : "Save email"}
      </Button>
      {sent ? <p className="mt-2 text-sm">Check your inbox for the verification link.</p> : null}
      {error ? <p className="mt-2 text-sm text-late">{error}</p> : null}
    </form>
  );
}

export function AccountView() {
  const { account, refresh } = useAccount();
  const params = useSearchParams();

  useEffect(() => {
    if (params.get("verified") !== "1") return;
    void refresh();
  }, [params, refresh]);

  if (!account) return null;

  return (
    <AuthPane>
      <div className="flex flex-col gap-4">
        <p className="eyebrow">Account</p>
        <h1 className="auth-title">Your account</h1>
        {account.role === "admin" ? (
          <Link href="/desk" className="auth-text-link w-fit">
            Operator desk
          </Link>
        ) : null}
        {params.get("verified") === "1" ? <p className="text-base">Email verified.</p> : null}
        {account.role === "reseller" ? (
          <p className="text-pretty text-base leading-relaxed text-muted-foreground">
            <Link href="/shop/reseller" className="auth-text-link">
              Reseller program coming soon.
            </Link>
          </p>
        ) : null}
        <ReceiptEmail />
        <AuthenticatorSetup enabled={account.totpEnabled === true} onChanged={refresh} />
        <div id="payouts">
          <ConnectPayout />
        </div>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          The account is kept on the server. Bank details stay at Stripe.
        </p>
      </div>
    </AuthPane>
  );
}
