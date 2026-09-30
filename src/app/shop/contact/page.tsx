"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ShopFrame } from "@/components/shop-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/store/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "The note did not send.");
      return;
    }
    setSent(true);
  }

  return (
    <ShopFrame>
      <article className="mx-auto max-w-xl px-4 py-8 sm:px-6">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Store</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Write the seller</h1>
        <p className="mt-2 text-base text-pretty text-foreground">
          Use this for a question, a return, or a late box. The note goes to the seller.
        </p>
        {sent ? (
          <p className="mt-6 text-sm">The seller has the note.</p>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Name
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Email
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Note
              <Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} required />
            </label>
            {error ? <p className="text-sm text-late">{error}</p> : null}
            <Button type="submit" disabled={pending} className="w-fit">
              {pending ? "Sending…" : "Send the note"}
            </Button>
          </form>
        )}
        <p className="mt-8 text-sm">
          <Link href="/shop/safety" className="underline underline-offset-4">
            How buying works
          </Link>
        </p>
      </article>
    </ShopFrame>
  );
}
