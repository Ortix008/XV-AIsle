"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/money";

type PendingItem = {
  id: string;
  title: string;
  supplierName: string;
  costCents: number;
  shippingCents: number;
};

export function PendingCatalog({ items }: { items: PendingItem[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function review(id: string, approved: boolean) {
    setError(null);
    setPendingId(id);
    const response = await fetch("/api/supplier/catalog/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, approved }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setPendingId(null);
    if (!response.ok) {
      setError(data?.error ?? "That product was not updated.");
      return;
    }
    router.refresh();
  }

  return (
    <section className="px-4 py-4 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pending catalog</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Supplier products waiting for a yes. Approve puts one on the reseller list. Reject leaves it off the shop.
      </p>
      {error ? <p className="mt-3 text-sm text-late">{error}</p> : null}
      {items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nothing is waiting.</p>
      ) : (
        <ul className="mt-4 divide-y border-t">
          {items.map((item) => (
            <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 text-sm">
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-muted-foreground">
                  {item.supplierName || "Supplier"} · cost {money(item.costCents / 100)} · shipping{" "}
                  {money(item.shippingCents / 100)}
                </p>
                <p className="mt-1 text-muted-foreground">No photo</p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={pendingId !== null}
                  onClick={() => void review(item.id, true)}
                >
                  {pendingId === item.id ? "Saving…" : "Approve"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pendingId !== null}
                  onClick={() => void review(item.id, false)}
                >
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
