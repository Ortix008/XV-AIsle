"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { ShopFrame } from "@/components/shop-frame";
import { formatISODate } from "@/lib/business-days";
import { RETURNS_UNSET } from "@/lib/return-address";
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
  returnAddress: string | null;
};

type DelayOffer = {
  number: string;
  title: string;
  expectedOn: string | null;
  refundRequestedAt: number | null;
  refundDueAt: number | null;
  refundedAt: number | null;
};

function OrderBody() {
  const params = useSearchParams();
  const delayToken = params.get("delay") ?? "";
  const token = params.get("token") ?? "";
  const [delay, setDelay] = useState<DelayOffer | null>(null);
  const [order, setOrder] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(
    token || delayToken ? null : "This page needs the link from your receipt.",
  );
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!delayToken) return;
    let cancel = false;
    fetch(`/api/store/delay?token=${encodeURIComponent(delayToken)}`)
      .then(async (response) => {
        if (cancel) return;
        const data = (await response.json().catch(() => null)) as { order?: DelayOffer; error?: string } | null;
        if (!response.ok || !data?.order) {
          setError(data?.error ?? "That refund link does not match an order.");
          return;
        }
        setDelay(data.order);
      })
      .catch(() => {
        if (!cancel) setError("That refund link does not match an order.");
      });
    return () => {
      cancel = true;
    };
  }, [delayToken]);

  useEffect(() => {
    if (!token || delayToken) return;
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
  }, [token, delayToken]);

  async function requestRefund() {
    setPending(true);
    setError(null);
    const response = await fetch("/api/store/delay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: delayToken }),
    });
    const data = (await response.json().catch(() => null)) as { order?: DelayOffer; error?: string } | null;
    setPending(false);
    if (data?.order) setDelay(data.order);
    if (!response.ok) {
      setError(data?.error ?? "The refund did not go through.");
      return;
    }
    if (!data?.order) {
      setError("The refund did not go through.");
      return;
    }
  }

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
    <div className="page-read">
      <p className="eyebrow">Order</p>
      <h1 className="page-title">{delay ? "Your order is delayed" : "Your delivery"}</h1>
      {delay ? (
        <div className="mt-6 space-y-3 text-base">
          <p>
            <span className="font-mono text-xs">{delay.number}</span>
            <span className="ml-2 font-medium">{delay.title}</span>
          </p>
          <p>
            {delay.expectedOn
              ? `The new expected date is ${formatISODate(delay.expectedOn)}.`
              : "We do not have a new ship date yet."}
          </p>
          <p className="text-muted-foreground">
            You can take a full refund instead. If you choose it, the charge is refunded in Stripe within 7 working days.
          </p>
          {delay.refundedAt ? (
            <p>The refund is in. It was sent within 7 working days of your request.</p>
          ) : delay.refundRequestedAt ? (
            <p>
              The refund is requested
              {delay.refundDueAt ? ` and is due by ${new Date(delay.refundDueAt).toLocaleDateString()}.` : "."}
            </p>
          ) : (
            <Button type="button" disabled={pending} onClick={() => void requestRefund()}>
              {pending ? "Requesting…" : "Request a full refund"}
            </Button>
          )}
        </div>
      ) : null}
      {order && !delay ? (
        <div className="mt-6 space-y-3 text-base">
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
          <p className="whitespace-pre-wrap">{order.returnAddress ?? RETURNS_UNSET}</p>
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
      <Suspense fallback={<p className="page-read text-base text-muted-foreground">Opening the order…</p>}>
        <OrderBody />
      </Suspense>
    </ShopFrame>
  );
}
