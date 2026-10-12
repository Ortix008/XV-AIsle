"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AisleHero } from "@/components/aisle-hero";
import { OrderCard, type OrderCardFacts } from "@/components/order-card";
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
    let cancel = false;
    fetch(`/api/store/checkout?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (response) => {
        if (cancel) return;
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          order?: { number: string; supplierDetail: string | null };
          summary?: CheckoutSummary;
        } | null;
        if (!response.ok) {
          setError(data?.error ?? "Payment was not confirmed.");
          return;
        }
        if (data?.summary) setSummary(data.summary);
        if (data?.order) setDetail(data.order.supplierDetail ?? "The supplier has the order.");
        if (!data?.order && !data?.summary) setDetail("Payment is recorded.");
      })
      .catch(() => {
        if (!cancel) setError("Payment was not confirmed.");
      });
    return () => {
      cancel = true;
    };
  }, [sessionId]);

  const lede = error ?? detail ?? (sessionId ? "Confirming payment…" : null);
  const receiptHref = token ? `/shop/order?token=${encodeURIComponent(token)}` : null;

  return (
    <>
      <AisleHero kicker="Order" title={summary ? "Your order is in." : "After payment"} lede={lede}>
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
          <AisleHero kicker="Order" title="After payment" lede="Confirming payment…" />
        }
      >
        <ReturnBody />
      </Suspense>
    </ShopFrame>
  );
}
