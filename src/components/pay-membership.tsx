"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MEMBER_PRICE } from "@/lib/account";
import { isStripeCheckoutUrl } from "@/lib/checkout-url";
import { useAccount } from "@/lib/account-store";

export function PayMembership() {
  const { billing } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function pay() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/billing/checkout", { method: "POST" });
    const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
    if (!response.ok || !data?.url || !isStripeCheckoutUrl(data.url)) {
      setError(data?.error ?? "Checkout did not open.");
      setPending(false);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" className="w-fit" onClick={pay} disabled={pending}>
        {pending ? "Opening checkout…" : `Pay $${MEMBER_PRICE} a month`}
      </Button>
      {billing ? null : (
        <p className="text-xs text-pretty text-muted-foreground">
          Checkout uses Stripe. It stays closed until STRIPE_SECRET_KEY is set on the server.
        </p>
      )}
      {error ? <p className="text-sm text-late">{error}</p> : null}
    </div>
  );
}
