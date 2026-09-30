"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ShopFrame } from "@/components/shop-frame";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Receipt = {
  number: string;
  title: string;
  status: string;
  deliveredAt: number | null;
  carrier: string | null;
  trackingNumber: string | null;
  buyerConfirmedAt: number | null;
  buyerDisputeOpen: boolean;
  windowEndsAt: number | null;
};

function OrderBody() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(token ? null : "This page needs the link from your receipt.");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancel = false;
    fetch(`/api/store/receipt?token=${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (cancel) return;
        const data = (await response.json().catch(() => null)) as { order?: Receipt; error?: string } | null;
        if (!response.ok || !data?.order) {
          setError(data?.error ?? "That receipt link does not match an order.");
          return;
        }
        setOrder(data.order);
      })
      .catch(() => {
        if (!cancel) setError("That receipt link does not match an order.");
      });
    return () => {
      cancel = true;
    };
  }, [token]);

  async function send(action: "confirm" | "dispute") {
    setPending(true);
    setError(null);
    const response = await fetch("/api/store/receipt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action, note }),
    });
    const data = (await response.json().catch(() => null)) as { order?: Receipt; error?: string } | null;
    setPending(false);
    if (!response.ok || !data?.order) {
      setError(data?.error ?? "That update did not save.");
      return;
    }
    setOrder(data.order);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Order</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your delivery</h1>
      {order ? (
        <div className="mt-4 space-y-3 text-sm">
          <p>
            <span className="font-mono text-xs">{order.number}</span>
            <span className="ml-2 font-medium">{order.title}</span>
          </p>
          <p className="text-muted-foreground">
            {order.carrier && order.trackingNumber
              ? `${order.carrier} · ${order.trackingNumber}`
              : "Tracking is not on this order yet."}
            {order.deliveredAt ? " Delivered." : ""}
            {order.buyerConfirmedAt ? " You confirmed it." : ""}
            {order.buyerDisputeOpen ? " A dispute is open." : ""}
          </p>
          {order.windowEndsAt && !order.buyerConfirmedAt && !order.buyerDisputeOpen ? (
            <p className="text-muted-foreground">
              If you do not dispute it, the seller can be paid after{" "}
              {new Date(order.windowEndsAt).toLocaleDateString()}.
            </p>
          ) : null}
          {order.deliveredAt && !order.buyerConfirmedAt && !order.buyerDisputeOpen ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send("confirm");
              }}
            >
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "I received this"}
              </Button>
              <label className="flex flex-col gap-1">
                Something wrong?
                <Textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} />
              </label>
              <Button type="button" variant="outline" disabled={pending} onClick={() => void send("dispute")}>
                Dispute this delivery
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-late">{error}</p> : null}
    </div>
  );
}

export default function BuyerOrderPage() {
  return (
    <ShopFrame>
      <Suspense fallback={<p className="px-4 py-10 text-sm text-muted-foreground">Opening the order…</p>}>
        <OrderBody />
      </Suspense>
    </ShopFrame>
  );
}
