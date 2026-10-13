"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReturnsForm({ returns, supportEmail }: { returns: string; supportEmail: string }) {
  const [address, setAddress] = useState(returns);
  const [email, setEmail] = useState(supportEmail);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(null);
    const response = await fetch("/api/store/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returns: address, supportEmail: email }),
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; returns?: string; supportEmail?: string }
      | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "Those settings did not save.");
      return;
    }
    setAddress(data?.returns ?? "");
    setEmail(data?.supportEmail ?? "");
    setSaved("Saved. Buyers see this on the policy pages.");
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3 border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">Store contact</h2>
      <p className="text-sm text-muted-foreground">
        Signed in as the operator. Buyers see these lines on Returns, Shipping, Terms, and Privacy. Use a business
        address, not a home address.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Return address
        <Input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          placeholder="Street, city, state, postal code"
          autoComplete="off"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Support email
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          autoComplete="off"
        />
      </label>
      {error ? <p className="text-sm text-late">{error}</p> : null}
      {saved ? <p className="text-sm">{saved}</p> : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save store contact"}
      </Button>
    </form>
  );
}
