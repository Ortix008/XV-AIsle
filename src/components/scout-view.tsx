"use client";

import { useLayoutEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BotControls } from "@/components/desk-shell";
import { EmptyNote, MarginFigure, MockupFrame, Money, PageHeader, Tone } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { getProduct, trendSourceLabel } from "@/lib/catalog";
import { prettyDate, todayISO } from "@/lib/dates";
import { useDesk } from "@/lib/desk-store";
import { assess, assumptionLine, laneLabel, speedLabel } from "@/lib/engine";
import { cn } from "cn";

const filters = [
  { id: "review", label: "In review" },
  { id: "approved", label: "Approved" },
  { id: "passed", label: "Skipped" },
  { id: "all", label: "All" },
] as const;

export function ScoutView() {
  const { state, select, pickSupplier, setShortlistStatus } = useDesk();
  const searchParams = useSearchParams();
  const queryItem = searchParams.get("item");
  const [filter, setFilter] = useState<(typeof filters)[number]["id"]>("review");
  const [followedQuery, setFollowedQuery] = useState<string | null>(null);
  const today = todayISO();
  const queryKnown =
    queryItem != null &&
    queryItem !== followedQuery &&
    state.pipeline.some((row) => row.productId === queryItem);
  const activeFilter = queryKnown ? "all" : filter;

  useLayoutEffect(() => {
    if (!queryKnown || window.innerWidth >= 1024) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("signal-dossier")?.scrollIntoView({
      block: "start",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [queryKnown, queryItem]);

  function chooseFilter(id: (typeof filters)[number]["id"]) {
    if (queryItem) setFollowedQuery(queryItem);
    setFilter(id);
  }

  function chooseProduct(id: string) {
    if (queryItem) setFollowedQuery(queryItem);
    select("scout", id);
  }

  const rows = state.pipeline.filter((item) => activeFilter === "all" || item.status === activeFilter);
  const selectedId = queryKnown ? queryItem : state.selected.scout;
  const selected =
    state.pipeline.find((item) => item.productId === selectedId) ??
    rows[0] ??
    state.pipeline[0];

  const deskEmpty = state.pipeline.length === 0 && state.queue.length === 0;

  return (
    <div className="flex flex-col lg:h-full">
      <PageHeader
        kicker="Signal"
        title="Find the product"
        lede="Signal looks for a product people already want and a supplier in the US. Kitchen tools, clothes, sports, home, and simple party extras. Not fresh food. A slow boat can stay on the list so you can see it. It is not the pick."
        actions={<BotControls id="scout" />}
      />
      {deskEmpty ? (
        <EmptyNote
          title="No products yet."
          body="When a supplier's approved items are connected, Signal will list them here."
        />
      ) : (
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] lg:overflow-hidden">
        <div className="min-w-0 border-b lg:overflow-y-auto lg:border-r lg:border-b-0">
          <div className="flex flex-wrap items-center gap-1 px-4 py-3 sm:px-6">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseFilter(item.id)}
                className={cn(
                  "rounded-md px-2 py-1 text-sm",
                  activeFilter === item.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted",
                )}
              >
                {item.label}
              </button>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {state.queue.length} still waiting
            </span>
          </div>
          {state.queue.length > 0 ? (
            <p className="px-4 pb-3 text-pretty text-xs text-muted-foreground sm:px-6">
              Still to look at:{" "}
              {state.queue
                .map((id) => {
                  const queued = getProduct(id);
                  return `${queued.titleLead} (${laneLabel(queued.lane)})`;
                })
                .join(" · ")}
            </p>
          ) : null}
          {rows.length === 0 ? (
            <EmptyNote
              title="Nothing in this filter."
              body={
                activeFilter === "review"
                  ? "Leave Signal on and the next product shows up here."
                  : "Try another filter, or ask Signal to look again."
              }
            />
          ) : (
            <>
              <ul className="divide-y border-y md:hidden">
                {rows.map((item) => {
                  const product = getProduct(item.productId);
                  const view = assess(product, today, item.pickedSupplierId);
                  const active = selected?.productId === item.productId;
                  return (
                    <li key={item.productId}>
                      <button
                        type="button"
                        onClick={() => chooseProduct(item.productId)}
                        className={cn(
                          "flex w-full flex-col items-start gap-1 px-4 py-3 text-left",
                          active ? "bg-muted/70" : "hover:bg-muted/40",
                        )}
                      >
                        <span className="text-sm font-medium">
                          {product.titleLead}
                          {item.discoveredOn === today ? (
                            <span className="ml-2 text-xs font-normal text-ok">New</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {laneLabel(product.lane)} · {trendSourceLabel(product.trend.platform)} · {product.sku}
                        </span>
                        <span className="flex flex-wrap items-center gap-3 text-sm">
                          <Money value={view.chosen.list} />
                          <MarginFigure margin={view.chosen.margin} />
                          <StatusLabel status={item.status} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption className="sr-only">Products</caption>
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-y">
                    <th className="px-4 py-2 font-medium sm:px-6">Product</th>
                    <th className="px-3 py-2 font-medium">Where</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">You keep</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => {
                    const product = getProduct(item.productId);
                    const view = assess(product, today, item.pickedSupplierId);
                    const active = selected?.productId === item.productId;
                    return (
                      <tr
                        key={item.productId}
                        className={cn("border-b", active ? "bg-muted/70" : "hover:bg-muted/40")}
                      >
                        <td className="px-4 py-2.5 sm:px-6">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => chooseProduct(item.productId)}
                          >
                            <span className="font-medium">{product.titleLead}</span>
                            {item.discoveredOn === today ? (
                              <span className="ml-2 text-xs text-ok">New</span>
                            ) : null}
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {laneLabel(product.lane)} · {product.sku}
                            </span>
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">{trendSourceLabel(product.trend.platform)}</td>
                        <td className="px-3 py-2.5">
                          <Money value={view.chosen.list} />
                        </td>
                        <td className="px-3 py-2.5">
                          <MarginFigure margin={view.chosen.margin} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusLabel status={item.status} />
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
          {selected ? (
            <Dossier
              productId={selected.productId}
              status={selected.status}
              pickedSupplierId={selected.pickedSupplierId}
              onPick={(supplierId) => pickSupplier(selected.productId, supplierId)}
              onStatus={(status) => setShortlistStatus(selected.productId, status)}
            />
          ) : (
            <EmptyNote title="No products yet." body="Ask Signal for the next product." />
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function StatusLabel({ status }: { status: "review" | "approved" | "passed" }) {
  if (status === "approved") return <Tone tone="ok">Approved</Tone>;
  if (status === "passed") return <Tone tone="muted">Skipped</Tone>;
  return <Tone tone="warn">In review</Tone>;
}

function Dossier({
  productId,
  status,
  pickedSupplierId,
  onPick,
  onStatus,
}: {
  productId: string;
  status: "review" | "approved" | "passed";
  pickedSupplierId: string | null;
  onPick: (supplierId: string) => void;
  onStatus: (status: "review" | "approved" | "passed") => void;
}) {
  const product = getProduct(productId);
  const today = todayISO();
  const view = assess(product, today, pickedSupplierId);

  return (
    <article id="signal-dossier" className="flex flex-col gap-6 px-4 py-5 sm:px-6">
      <div>
        <p className="text-xs text-muted-foreground">
          {laneLabel(product.lane)} · {trendSourceLabel(product.trend.platform)} · {product.trend.title}
        </p>
        <h2 className="text-balance text-lg font-semibold tracking-tight">{product.name}</h2>
        <p className="mt-2 text-pretty text-sm">{product.trend.evidence}</p>
        <p className="mt-2 text-pretty text-sm text-muted-foreground">{product.trend.signal}</p>
      </div>

      <div>
        <h3 className="text-sm font-medium">Why this supplier</h3>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">{view.reason}</p>
        {view.needBy ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Need it by {prettyDate(view.needBy)} for {product.occasion}.
          </p>
        ) : null}
      </div>

      <div>
        <h3 className="sr-only">Supplier comparison</h3>
        <ul className="divide-y border-y">
          {view.rows.map((row) => {
            const using = row.supplier.id === view.chosen.supplier.id;
            return (
              <li key={row.supplier.id} className={cn("py-3", using && "-mx-2 bg-muted/60 px-2")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {row.supplier.name}
                      {using ? <span className="ml-2 text-xs font-medium text-ok">Using</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className={row.supplier.speed === "import" ? "text-late" : undefined}>
                        {speedLabel(row.supplier.speed)}
                      </span>
                      {" · "}
                      {row.supplier.origin} · {row.supplier.rating} · {row.supplier.reviews} orders · MOQ{" "}
                      {row.supplier.moq}
                    </p>
                  </div>
                  {using ? null : (
                    <Button type="button" variant="outline" size="sm" onClick={() => onPick(row.supplier.id)}>
                      Use quote
                    </Button>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-muted-foreground">Landed</dt>
                    <dd>
                      <Money value={row.landed} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Shelf</dt>
                    <dd>
                      <Money value={row.list} />
                      {row.capped ? <span className="ml-1 text-xs text-warn">At ceiling</span> : null}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Net</dt>
                    <dd>
                      <MarginFigure margin={row.margin} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Arrives</dt>
                    <dd>
                      {prettyDate(row.arrives)}
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {row.supplier.shipDaysMin}–{row.supplier.shipDaysMax} days
                        {view.needBy ? (row.fits ? " · fits" : " · misses") : ""}
                      </span>
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-pretty text-xs text-muted-foreground">{row.supplier.note}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-pretty text-xs text-muted-foreground">{assumptionLine()}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Pros</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {view.pros.map((pro) => (
              <li key={pro} className="text-pretty">
                {pro}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-medium">Cons</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {view.cons.map((con) => (
              <li key={con} className="text-pretty">
                {con}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium">Mockup ideas</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {product.mockups.map((idea) => (
            <MockupFrame key={idea.title} idea={idea} swatch={product.swatch} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        {status !== "approved" ? (
          <Button type="button" onClick={() => onStatus("approved")}>
            Approve product
          </Button>
        ) : (
          <Tone tone="ok">Approved for a listing</Tone>
        )}
        {status !== "passed" ? (
          <Button type="button" variant="outline" onClick={() => onStatus("passed")}>
            Pass
          </Button>
        ) : null}
        {status !== "review" ? (
          <Button type="button" variant="ghost" onClick={() => onStatus("review")}>
            Return to review
          </Button>
        ) : null}
      </div>
    </article>
  );
}
