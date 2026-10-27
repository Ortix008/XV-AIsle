"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WAITLIST_SAVED } from "@/lib/waitlist-copy";
import { submitResellerWaitlist } from "@/lib/waitlist-submit";

export function ResellerWaitlist() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const field = String(new FormData(event.currentTarget).get("email") ?? "");
    setPending(true);
    setMessage(null);
    try {
      const result = await submitResellerWaitlist(field);
      setMessage(result.ok ? WAITLIST_SAVED : result.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-md flex-col gap-3">
      <label className="flex flex-col gap-1 text-base">
        Email
        <Input
          type="email"
          name="email"
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
