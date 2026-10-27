"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AisleHero } from "@/components/aisle-hero";
import { OrderCard, type OrderCardFacts } from "@/components/order-card";
import {
  CONFIRM_GIVE_UP_MS,
  CONFIRM_POLL_MS,
  CONFIRMING_PAYMENT,
  PAYMENT_UNCONFIRMED,
  confirmStep,
  type ConfirmPayload,
} from "@/lib/return-confirm";
import { ShopFrame } from "@/components/shop-frame";

type CheckoutSummary = OrderCardFacts & { productId: string };

function ReturnBody() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const token = params.get("token");
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    sessionId ? null : "Checkout did not come back with a payment.",
  );

  useEffect(() => {
    if (!sessionId) return;
    const checkoutId = sessionId;
    let cancel = false;
    const started = Date.now();
    const controller = new AbortController();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ms);
        controller.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    async function tick() {
      while (!cancel) {
        const elapsed = Date.now() - started;
        if (elapsed >= CONFIRM_GIVE_UP_MS) {
          setError(PAYMENT_UNCONFIRMED);
          return;
        }
        const attempt = new AbortController();
        const attemptTimer = setTimeout(() => attempt.abort(), 5000);
        try {
          const response = await fetch(`/api/store/checkout?session_id=${encodeURIComponent(checkoutId)}`, {
            cache: "no-store",
            signal: AbortSignal.any([controller.signal, attempt.signal]),
          });
          const data = (await response.json().catch(() => null)) as (ConfirmPayload & { summary?: CheckoutSummary }) | null;
          if (cancel) return;
          const step = confirmStep(response.status, data);
          if (step.kind === "paid" && data?.summary) {
            setSummary(data.summary);
            setDetail(step.detail);
            setError(null);
            return;
          }
          if (step.kind === "error") {
            setError(step.message);
            return;
          }
        } catch {
          if (cancel || controller.signal.aborted) return;
        } finally {
          clearTimeout(attemptTimer);
        }
        const remaining = CONFIRM_GIVE_UP_MS - (Date.now() - started);
        if (remaining <= 0) {
          if (!cancel) setError(PAYMENT_UNCONFIRMED);
          return;
        }
        await wait(Math.min(CONFIRM_POLL_MS, remaining));
      }
    }
    void tick();
    return () => {
      cancel = true;
      controller.abort();
    };
  }, [sessionId]);

  const lede = error ?? detail ?? (sessionId ? CONFIRMING_PAYMENT : null);
  const receiptHref = token ? `/shop/order?token=${encodeURIComponent(token)}` : null;

  return (
    <>
      <AisleHero className="hero-confirm" kicker="Order" title={summary ? "Your order is in." : "After payment"} lede={lede}>
        {receiptHref ? (
          <a className="pill pill-ghost" href={receiptHref}>
            Open your receipt
          </a>
        ) : null}
      </AisleHero>
      {summary ? (
        <div className="order-sheet-wrap">
          <OrderCard facts={summary} />
        </div>
      ) : null}
    </>
  );
}

export default function ReturnPage() {
  return (
    <ShopFrame>
      <Suspense
        fallback={
          <AisleHero className="hero-confirm" kicker="Order" title="After payment" lede={CONFIRMING_PAYMENT} />
        }
      >
        <ReturnBody />
      </Suspense>
    </ShopFrame>
  );
}
