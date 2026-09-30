"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReturnsForm({ initial }: { initial: string }) {
  const [address, setAddress] = useState(initial);
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
      body: JSON.stringify({ returns: address }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; returns?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "The address did not save.");
      return;
    }
    setAddress(data?.returns ?? "");
    setSaved(data?.returns ? "Buyers can see this return address." : "The return address is cleared.");
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-2 border bg-card p-4">
      <h2 className="text-sm font-medium text-foreground">Return address</h2>
      <p className="text-sm text-muted-foreground">
        Signed in. This line is what buyers see. Use the street, city, state, and postal code where a box can come back.
      </p>
      <Input
        value={address}
        onChange={(event) => setAddress(event.target.value)}
        placeholder="Street, city, state, postal code"
        autoComplete="street-address"
      />
      {error ? <p className="text-sm text-late">{error}</p> : null}
      {saved ? <p className="text-sm">{saved}</p> : null}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save return address"}
      </Button>
    </form>
  );
}
