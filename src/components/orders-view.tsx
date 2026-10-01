"use client";

import { useCallback, useEffect, useState } from "react";
import { BotControls } from "@/components/desk-shell";
import { CopyButton, EmptyNote, Money, PageHeader, Tone } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/lib/account-store";
import { prettyDate, todayISO } from "@/lib/dates";
import { useDesk } from "@/lib/desk-store";
import { money, round2 } from "@/lib/money";
import type { Order } from "@/lib/types";
import { cn } from "cn";

function safeMailto(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return `mailto:${encodeURIComponent(email)}`;
}

function CustomerMail({ email }: { email: string }) {
  const href = safeMailto(email);
  if (!href) return email;
  return (
    <a className="underline-offset-4 hover:underline" href={href}>
      {email}
    </a>
  );
}

const liveStatus: Record<string, string> = {
  pending: "Waiting for payment",
  paid: "Paid, payout waiting",
  queued: "Waiting on the supplier",
  accepted: "Supplier accepted",
  supplier_error: "Supplier did not accept",
  fulfilling: "Sending to the supplier",
};

function ShopperNotes() {
  const [notes, setNotes] = useState<{ id: string; name: string; email: string; message: string }[]>([]);
  useEffect(() => {
    fetch("/api/store/contact")
      .then((response) => (response.ok ? response.json() : { inquiries: [] }))
      .then((data: { inquiries: typeof notes }) => setNotes(data.inquiries ?? []))
      .catch(() => setNotes([]));
  }, []);
  if (notes.length === 0) return null;
  return (
    <section className="border-b px-4 py-3 sm:px-6">
      <h2 className="text-sm font-medium">Notes from shoppers</h2>
      <ul className="mt-2 divide-y">
        {notes.map((note) => (
          <li key={note.id} className="py-2 text-sm">
            <span className="font-medium">{note.name}</span>
            <span className="text-muted-foreground"> · {note.email}</span>
            <span className="mt-0.5 block text-muted-foreground">{note.message}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function StoreOrders() {
  const { account } = useAccount();
  const [orders, setOrders] = useState<
    {
      id: string;
      number: string;
      title?: string;
      status: string;
      supplierDetail: string | null;
      deliveredAt: number | null;
      payoutNote: string | null;
      riskApproved: boolean;
    }[]
  >([]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<{ id: string; number: string; kind: "nearing" | "refund" }[]>([]);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");

  const load = useCallback(() => {
    fetch("/api/orders")
      .then((response) => (response.ok ? response.json() : { orders: [], alerts: [] }))
      .then((data: { orders: typeof orders; alerts?: typeof alerts }) => {
        setOrders(data.orders ?? []);
        setAlerts(data.alerts ?? []);
      })
      .catch(() => {
        setOrders([]);
        setAlerts([]);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: "deliver" | "release") {
    setActionError(null);
    const response = await fetch(`/api/orders/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: action === "deliver" ? JSON.stringify({ carrier, tracking }) : "{}",
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setActionError(data?.error ?? "That order did not update.");
      return;
    }
    load();
  }

  if (orders.length === 0) return null;
  return (
    <section className="border-b px-4 py-3 sm:px-6">
      <h2 className="text-sm font-medium">From the store</h2>
      {account?.role === "admin" && alerts.length > 0 ? (
        <div className="mt-2 border bg-muted/40 px-3 py-2 text-sm">
          <p className="font-medium">Hold window</p>
          <ul className="mt-1 space-y-1 text-muted-foreground">
            {alerts.map((alert) => (
              <li key={alert.id}>
                {alert.number}:{" "}
                {alert.kind === "refund"
                  ? "Past the 730-day hold. Refund this charge."
                  : "Inside the last 14 days of the hold. Refund it if it will not transfer in time."}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {actionError ? <p className="mt-2 text-sm text-late">{actionError}</p> : null}
      {account?.role === "admin" && account.emailVerified ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            placeholder="Carrier"
            className="h-8 border bg-background px-2 text-sm"
          />
          <input
            value={tracking}
            onChange={(event) => setTracking(event.target.value)}
            placeholder="Tracking number"
            className="h-8 border bg-background px-2 text-sm"
          />
        </div>
      ) : null}
      <ul className="mt-2 divide-y">
        {orders.map((order) => (
          <li key={order.id} className="py-2 text-sm">
            <span className="font-mono text-xs">{order.number}</span>
            <span className="ml-2 font-medium">{order.title}</span>
            <span className="mt-0.5 block text-muted-foreground">
              {order.deliveredAt ? "Delivered · " : ""}
              {liveStatus[order.status] ?? order.status}
              {order.supplierDetail ? ` · ${order.supplierDetail}` : ""}
            </span>
            {order.payoutNote ? <span className="mt-0.5 block text-muted-foreground">{order.payoutNote}</span> : null}
            {account?.role === "admin" && account.emailVerified && order.status !== "pending" ? (
              <span className="mt-2 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void act(order.id, "deliver")}>
                  Mark delivered
                </Button>
                {!order.riskApproved ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => void act(order.id, "release")}>
                    Approve payout
                  </Button>
                ) : null}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

const filters = [
  { id: "open", label: "Open" },
  { id: "late", label: "Delays" },
  { id: "quality", label: "Quality" },
  { id: "all", label: "All" },
] as const;

export function OrdersView() {
  const { state, select, runPass } = useDesk();
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("open");
  const today = todayISO();
  const rows = state.orders.filter((order) => {
    if (filter === "all") return true;
    if (filter === "late") return order.flag === "delay";
    if (filter === "quality") return order.flag === "quality";
    return order.status !== "delivered";
  });
  const selected = state.orders.find((order) => order.id === state.selected.order) ?? rows[0];

  return (
    <div className="flex flex-col lg:h-full">
      <PageHeader
        kicker="Harbor"
        title="Watch the order"
        lede="Tells you if an order is late or something arrived broken, and writes the reply. Saying yes here does not send it."
        actions={<BotControls id="orders" />}
      />
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:overflow-hidden">
        <div className="min-w-0 border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
          <StoreOrders />
          <ShopperNotes />
          <div className="flex flex-wrap gap-1 px-4 py-3 sm:px-6">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={cn(
                  "rounded-md px-2 py-1 text-sm",
                  filter === item.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          {rows.length === 0 ? (
            <EmptyNote
              title="Nothing in this filter."
              body="Open orders with a future ETA stay quiet. A pass flags the ones that missed."
            />
          ) : (
            <>
              <ul className="divide-y border-y md:hidden">
                {rows.map((order) => {
                  const active = selected?.id === order.id;
                  const etaPast = order.status !== "delivered" && order.eta < today;
                  return (
                    <li key={order.id}>
                      <button
                        type="button"
                        onClick={() => select("order", order.id)}
                        className={cn(
                          "flex w-full flex-col items-start gap-1 px-4 py-3 text-left",
                          active ? "bg-muted/70" : "hover:bg-muted/40",
                        )}
                      >
                        <span className="font-mono text-xs">{order.number}</span>
                        <span className="text-sm font-medium">{order.productName}</span>
                        <span className="text-xs text-muted-foreground">
                          {order.customer} · ETA{" "}
                          <span className={etaPast ? "text-late" : undefined}>{prettyDate(order.eta)}</span>
                        </span>
                        <FlagLabel order={order} />
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[680px] text-left text-sm">
                <caption className="sr-only">Orders</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-y">
                    <th className="px-4 py-2 font-medium sm:px-6">Order</th>
                    <th className="px-2 py-2 font-medium">Customer</th>
                    <th className="px-2 py-2 font-medium">ETA</th>
                    <th className="px-2 py-2 font-medium">Need by</th>
                    <th className="px-2 py-2 font-medium">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((order) => {
                    const active = selected?.id === order.id;
                    const etaPast = order.status !== "delivered" && order.eta < today;
                    return (
                      <tr key={order.id} className={cn("border-b", active ? "bg-muted/70" : "hover:bg-muted/40")}>
                        <td className="px-4 py-2.5 sm:px-6">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => select("order", order.id)}
                          >
                            <span className="font-mono text-xs">{order.number}</span>
                            <span className="mt-0.5 block font-medium">{order.productName}</span>
                          </button>
                        </td>
                        <td className="px-2 py-2.5">{order.customer}</td>
                        <td className="px-2 py-2.5">
                          <span className={etaPast ? "text-late" : undefined}>{prettyDate(order.eta)}</span>
                        </td>
                        <td className="px-2 py-2.5 text-muted-foreground">{prettyDate(order.needBy)}</td>
                        <td className="px-2 py-2.5">
                          <FlagLabel order={order} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
        <div className="min-w-0 lg:overflow-y-auto">
          {selected ? <OrderDossier order={selected} onCheck={() => runPass("orders")} /> : null}
        </div>
      </div>
    </div>
  );
}

function FlagLabel({ order }: { order: Order }) {
  if (order.flag === "delay") return <Tone tone="late">Late</Tone>;
  if (order.flag === "quality") return <Tone tone="late">Quality</Tone>;
  if (order.status === "delivered") return <Tone tone="ok">Delivered</Tone>;
  if (order.status === "processing") return <Tone tone="muted">Processing</Tone>;
  return <Tone tone="muted">In transit</Tone>;
}

function OrderDossier({ order, onCheck }: { order: Order; onCheck: () => void }) {
  const { updateReply, setReplyStatus } = useDesk();
  const today = todayISO();
  const total = round2(order.merchandise + order.shippingPaid);
  const etaPast = order.status !== "delivered" && order.eta < today && !order.flag;

  return (
    <article className="flex flex-col gap-5 px-4 py-5 sm:px-6">
      <div>
        <p className="font-mono text-xs text-muted-foreground">{order.number}</p>
        <h2 className="text-lg font-semibold tracking-tight">{order.productName}</h2>
        <p className="mt-1 text-sm">
          {order.customer} · <CustomerMail email={order.email} />
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Placed</dt>
        <dd>{prettyDate(order.placedOn)}</dd>
        <dt className="text-muted-foreground">Carrier</dt>
        <dd>
          {order.carrier}
          <span className="mt-0.5 block font-mono text-xs">{order.tracking}</span>
        </dd>
        <dt className="text-muted-foreground">Total</dt>
        <dd>
          <Money value={total} />
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {money(order.merchandise)} + {money(order.shippingPaid)} shipping
          </span>
        </dd>
        <dt className="text-muted-foreground">Qty</dt>
        <dd>{order.qty}</dd>
      </dl>

      {order.issue ? <p className="text-pretty text-sm">{order.issue}</p> : null}

      {etaPast ? (
        <div className="border border-border bg-muted/40 px-3 py-3 text-sm">
          <p>
            The ETA was {prettyDate(order.eta)} and this order is not flagged yet. The need-by date is{" "}
            {prettyDate(order.needBy)}.
          </p>
          <Button type="button" className="mt-3" size="sm" onClick={onCheck}>
            Flag and draft a reply
          </Button>
        </div>
      ) : null}

      {order.reply ? (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Reply</h3>
            {order.reply.status === "approved" ? (
              <Tone tone="ok">Approved to send yourself</Tone>
            ) : (
              <Tone tone="warn">Draft</Tone>
            )}
          </div>
          <p className="mt-2 text-sm">{order.reply.subject}</p>
          <Textarea
            value={order.reply.body}
            onChange={(event) => updateReply(order.id, event.target.value)}
            rows={14}
            className="mt-2 text-sm leading-relaxed"
            aria-label="Reply draft"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <CopyButton
              text={`Subject: ${order.reply.subject}\n\n${order.reply.body}`}
              label="Copy reply"
            />
            {order.reply.status === "draft" ? (
              <Button type="button" onClick={() => setReplyStatus(order.id, "approved")}>
                Approve reply
              </Button>
            ) : (
              <Button type="button" variant="outline" onClick={() => setReplyStatus(order.id, "draft")}>
                Return to draft
              </Button>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Editing the reply puts it back in draft. This desk does not email {order.customer}.
          </p>
        </div>
      ) : !etaPast ? (
        <p className="text-sm text-muted-foreground">
          No reply on this order. The monitor drafts one when it flags a delay or a quality issue.
        </p>
      ) : null}
    </article>
  );
}
