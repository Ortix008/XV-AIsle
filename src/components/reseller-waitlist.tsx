"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ResellerWaitlist() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/store/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(response.ok ? "Saved." : (data?.error ?? "Try again."));
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <h2 className="text-2xl">Reseller program coming soon.</h2>
      <label className="flex flex-col gap-1 text-base">
        Email
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          maxLength={120}
          required
          className="h-11 md:text-base"
        />
      </label>
      <Button type="submit" disabled={pending} className="h-12 w-fit rounded-full px-6">
        {pending ? "Sending…" : "Send"}
      </Button>
      {message ? <p className="text-base">{message}</p> : null}
    </form>
  );
}
