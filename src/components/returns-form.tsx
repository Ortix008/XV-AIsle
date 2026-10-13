"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReturnsForm({ supportEmail }: { supportEmail: string }) {
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
      body: JSON.stringify({ supportEmail: email }),
    });
    const data = (await response.json().catch(() => null)) as
      | { error?: string; supportEmail?: string }
      | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "That email did not save.");
      return;
    }
    setEmail(data?.supportEmail ?? "");
    setSaved("Saved. Buyers see this on the policy pages.");
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-foreground">Support email</h2>
      <p className="text-sm text-muted-foreground">
        Signed in as the operator. Buyers see this email on Returns, Shipping, Terms, and Privacy. Return addresses are
        saved per supplier below and are not a home address.
      </p>
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
        {pending ? "Saving…" : "Save support email"}
      </Button>
    </form>
  );
}
