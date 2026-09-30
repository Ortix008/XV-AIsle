"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CopyButton, PageHeader } from "@/components/bits";
import { storefrontUrl } from "@/lib/domain";
import { floorStatuses, reachNote, type FloorStatus } from "@/lib/floors";
import { cn } from "cn";

type FloorRow = {
  id: string;
  name: string;
  holds: string;
  reachUrl: string;
  status: FloorStatus;
  contact: string;
};

export function FloorsView() {
  const [origin, setOrigin] = useState("");
  const [floors, setFloors] = useState<FloorRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<{ id: string; name: string; city: string; makes: string; madeInUsa: boolean }[]>([]);
  const [shopName, setShopName] = useState("");
  const [shopCity, setShopCity] = useState("");
  const [shopMakes, setShopMakes] = useState("");
  const [shopUsa, setShopUsa] = useState(true);

  useEffect(() => {
    fetch("/api/floors")
      .then(async (response) => {
        const data = (await response.json()) as { origin?: string; floors?: FloorRow[]; error?: string };
        if (!response.ok) {
          setError(data.error ?? "The floor list did not open.");
          setFloors([]);
          return;
        }
        setOrigin(data.origin ?? "");
        setFloors(data.floors ?? []);
        fetch("/api/shops/small")
          .then((response) => (response.ok ? response.json() : { shops: [] }))
          .then((shopData: { shops: typeof shops }) => setShops(shopData.shops ?? []))
          .catch(() => setShops([]));
      })
      .catch(() => {
        setError("The floor list did not open.");
        setFloors([]);
      });
  }, []);

  async function save(floor: FloorRow, patch: Partial<Pick<FloorRow, "status" | "contact">>) {
    const next = { ...floor, ...patch };
    setFloors((current) => current?.map((item) => (item.id === floor.id ? next : item)) ?? current);
    setError(null);
    const response = await fetch("/api/floors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ floorId: floor.id, status: next.status, contact: next.contact }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; floor?: FloorRow } | null;
    if (!response.ok || !data?.floor) {
      setError(data?.error ?? "That update did not save.");
      return;
    }
    setFloors((current) => current?.map((item) => (item.id === data.floor!.id ? data.floor! : item)) ?? current);
  }

  const store = origin ? `${origin}/shop` : "";

  return (
    <div className="flex flex-col lg:h-full">
      <PageHeader
        kicker="Reach"
        title="The biggest US floors, asked to carry goods made here"
        lede="Walmart, Amazon, Costco, and the other large US companies are not connected. Copy a note that asks them to ship goods made in the USA, open their public page, and mark where the conversation is."
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        <p className="max-w-2xl text-sm text-pretty text-muted-foreground">
          {store ? (
            <>
              The domain for this market is <span className="font-medium text-foreground">xvaisle.com</span>. Register it,
              point it at the host, and set APP_URL to https://xvaisle.com. Until then this copy is at{" "}
              <span className="font-medium text-foreground">{store}</span>. Notes to a floor name{" "}
              <span className="font-medium text-foreground">{storefrontUrl(origin)}</span>.
            </>
          ) : (
            "Opening the store address…"
          )}
        </p>
        {error ? <p className="mt-3 text-sm text-late">{error}</p> : null}
        {floors === null ? <p className="mt-6 text-sm text-muted-foreground">Opening the floors…</p> : null}
        <ul className="mt-6 divide-y border-y">
          {floors?.map((floor) => (
            <li key={floor.id} className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight">{floor.name}</h2>
                <p className="mt-1 max-w-xl text-sm text-pretty text-muted-foreground">{floor.holds}</p>
                <p className="mt-2 text-sm">
                  <a href={floor.reachUrl} target="_blank" rel="noreferrer" className="underline underline-offset-4">
                    Their public seller page
                  </a>
                </p>
                <label className="mt-3 flex max-w-sm flex-col gap-1 text-sm">
                  Contact email, if you have one
                  <input
                    value={floor.contact}
                    onChange={(event) =>
                      setFloors((current) =>
                        current?.map((item) => (item.id === floor.id ? { ...item, contact: event.target.value } : item)) ??
                        current,
                      )
                    }
                    onBlur={() => void save(floor, { contact: floor.contact })}
                    className="h-9 border bg-background px-2"
                    placeholder="name@company.com"
                    autoComplete="off"
                  />
                </label>
              </div>
              <div className="flex flex-col items-start gap-3">
                <CopyButton text={reachNote(floor, storefrontUrl(origin || "http://127.0.0.1:4317"))} label="Copy the note" />
                <div className="flex flex-wrap gap-1">
                  {floorStatuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => void save(floor, { status: status.id })}
                      className={cn(
                        "border px-2 py-1 text-xs",
                        floor.status === status.id
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {status.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
        <section className="mt-10 max-w-xl">
          <h2 className="text-lg font-semibold tracking-tight">Small businesses</h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            A neighborhood shop gets its own place on the store. Add the name, the city, and what they make. National
            floors stay on the list above.
          </p>
          <ul className="mt-4 divide-y border-y">
            {shops.map((shop) => (
              <li key={shop.id} className="py-2 text-sm">
                <span className="font-medium">{shop.name}</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {shop.city}
                  {shop.madeInUsa ? " · Made in the USA" : ""}
                </span>
                <span className="mt-0.5 block text-muted-foreground">{shop.makes}</span>
              </li>
            ))}
          </ul>
          <form
            className="mt-4 flex flex-col gap-3"
            onSubmit={(event: FormEvent) => {
              event.preventDefault();
              setError(null);
              void fetch("/api/shops/small", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: shopName, city: shopCity, makes: shopMakes, madeInUsa: shopUsa }),
              })
                .then(async (response) => {
                  const data = (await response.json()) as { error?: string; shops?: typeof shops };
                  if (!response.ok) {
                    setError(data.error ?? "The shop did not save.");
                    return;
                  }
                  setShops(data.shops ?? []);
                  setShopName("");
                  setShopCity("");
                  setShopMakes("");
                })
                .catch(() => setError("The shop did not save."));
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              Business name
              <input value={shopName} onChange={(event) => setShopName(event.target.value)} className="h-9 border bg-background px-2" required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              City
              <input value={shopCity} onChange={(event) => setShopCity(event.target.value)} className="h-9 border bg-background px-2" required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              What they make
              <input value={shopMakes} onChange={(event) => setShopMakes(event.target.value)} className="h-9 border bg-background px-2" required />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={shopUsa} onChange={(event) => setShopUsa(event.target.checked)} />
              They make it in the USA
            </label>
            <button type="submit" className="w-fit border border-foreground px-3 py-1.5 text-sm">
              Add the business
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
