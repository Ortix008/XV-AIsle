"use client";

import type { ReactNode } from "react";
import { FindShare } from "@/components/find-share";
import { RETURNS_UNSET } from "@/lib/return-address";

export type OrderCardFacts = {
  number: string;
  title: string;
  qty?: number | null;
  amountCents?: number | null;
  shipsFrom?: string | null;
  eta?: string | null;
  returnAddress?: string | null;
  productId?: string | null;
};

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function OrderCard({ facts, children }: { facts: OrderCardFacts; children?: ReactNode }) {
  const shipsFrom = facts.shipsFrom?.trim() || null;
  const eta = facts.eta?.trim() || null;
  const returns = facts.returnAddress?.trim() || RETURNS_UNSET;
  return (
    <section className="order-sheet">
      <p className="font-mono text-xs tracking-wide text-primary">{facts.number}</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{facts.title}</h2>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {facts.qty != null ? (
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground">Qty</dt>
            <dd className="mt-1">{facts.qty}</dd>
          </div>
        ) : null}
        {facts.amountCents != null ? (
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground">Paid</dt>
            <dd className="mt-1">{money(facts.amountCents)}</dd>
          </div>
        ) : null}
        {shipsFrom ? (
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground">Ships from</dt>
            <dd className="mt-1">{shipsFrom}</dd>
          </div>
        ) : null}
        {eta ? (
          <div>
            <dt className="text-xs tracking-wide text-muted-foreground">Arrival</dt>
            <dd className="mt-1">{eta}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-5 text-xs tracking-wide text-muted-foreground">Returns</p>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{returns}</p>
      {facts.productId ? (
        <div className="mt-5">
          <FindShare title={facts.title} productId={facts.productId} />
        </div>
      ) : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
