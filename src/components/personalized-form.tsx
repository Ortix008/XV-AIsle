"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERSONALIZED_CLOSED, PERSONALIZED_TEXT_MAX, personalizedPlaceholders } from "@/lib/personalized";

export function PersonalizedForm() {
  const [text, setText] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const response = await fetch("/api/personalized", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customText: text }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(body?.error ?? PERSONALIZED_CLOSED);
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 max-w-xl space-y-4">
      <p className="text-sm text-muted-foreground">Approved designs: none yet.</p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {personalizedPlaceholders.map((item) => (
          <li key={item.kind}>
            {item.label}: not available yet.
          </li>
        ))}
      </ul>
      <label className="block text-sm">
        Name or monogram
        <Input
          className="mt-1 h-12"
          value={text}
          maxLength={PERSONALIZED_TEXT_MAX}
          onChange={(event) => setText(event.target.value)}
          autoComplete="off"
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : "Not available to purchase"}
      </Button>
      {message ? (
        <p className="text-sm font-medium" role="status">
          {message}
        </p>
      ) : null}
    </form>
  );
}
