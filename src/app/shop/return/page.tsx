"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ShopFrame } from "@/components/shop-frame";

function ReturnBody() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [message, setMessage] = useState(
    sessionId ? "Confirming payment…" : "Checkout did not come back with a payment.",
  );

  useEffect(() => {
    if (!sessionId) return;
    let cancel = false;
    fetch(`/api/store/checkout?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        if (cancel) return;
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          order?: { number: string; supplierDetail: string | null };
        } | null;
        if (!response.ok) {
          setMessage(data?.error ?? "Payment was not confirmed.");
          return;
        }
        if (data?.order) {
          setMessage(`${data.order.number}. ${data.order.supplierDetail ?? "The supplier has the order."}`);
          return;
        }
        setMessage("Payment is recorded.");
      })
      .catch(() => {
        if (!cancel) setMessage("Payment was not confirmed.");
      });
    return () => {
      cancel = true;
    };
  }, [sessionId]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Order</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">After payment</h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export default function ReturnPage() {
  return (
    <ShopFrame>
      <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Confirming payment…</p>}>
        <ReturnBody />
      </Suspense>
    </ShopFrame>
  );
}
