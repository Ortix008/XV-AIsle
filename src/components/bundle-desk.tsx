"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAccount } from "@/lib/account-store";
import { aisles } from "@/lib/aisles";
import { DELIVERY_WARN_BUSINESS_DAYS, deliveryExceedsWindow } from "@/lib/honest-price";
import { money } from "@/lib/money";

type Piece = {
  productId: string;
  title: string;
  supplierName: string;
  supplierOrigin: string;
  priceCents: number;
  shipDaysMax: number;
};

export function BundleDesk() {
  const { account } = useAccount();
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [productId, setProductId] = useState("");
  const [sku, setSku] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [aisle, setAisle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const admin = account?.role === "admin" && account.emailVerified;

  useEffect(() => {
    if (!admin) return;
    let ignore = false;
    fetch("/api/store/bundles")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { listings?: Piece[] };
        if (!ignore) setPieces(data.listings ?? []);
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [admin]);

  if (account?.role !== "admin") return null;

  const selected = pieces.filter((piece) => picked.includes(piece.productId));
  const supplierNames = [...new Set(selected.map((piece) => piece.supplierName.trim().toLowerCase()))];
  const mixed = supplierNames.length > 1;
  const slow = selected.some((piece) => deliveryExceedsWindow({ shipDaysMax: piece.shipDaysMax }));

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function save() {
    setPending(true);
    setMessage(null);
    const priceCents = Math.round(Number(price) * 100);
    void fetch("/api/store/bundles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: productId.trim(),
        sku: sku.trim(),
        title: title.trim(),
        description: description.trim(),
        priceCents,
        image: "",
        itemIds: picked,
        aisle,
      }),
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => null)) as { error?: string; priceCents?: number } | null;
        setPending(false);
        if (!response.ok) {
          setMessage(data?.error ?? "The bundle did not save.");
          return;
        }
        setMessage(`Bundle saved at ${money((data?.priceCents ?? priceCents) / 100)}. The page shows that price only.`);
      })
      .catch(() => {
        setPending(false);
        setMessage("The bundle did not save.");
      });
  }

  return (
    <section className="border-b px-4 py-5 sm:px-6">
      <h2 className="text-lg font-semibold tracking-tight">Bundle</h2>
      <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">
        Group published listings from one supplier. You set the bundle price. The page does not show a second price or a
        savings claim.
      </p>
      {!admin ? (
        <p className="mt-3 text-sm text-muted-foreground">Verify your email before you can price a bundle.</p>
      ) : (
        <div className="mt-4 flex max-w-xl flex-col gap-3">
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
            {pieces.length === 0 ? <li className="text-muted-foreground">No published listings to group yet.</li> : null}
            {pieces.map((piece) => (
              <li key={piece.productId}>
                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={picked.includes(piece.productId)}
                    onChange={() => toggle(piece.productId)}
                  />
                  <span>
                    {piece.title}{" "}
                    <span className="text-muted-foreground">
                      {piece.supplierName} · {money(piece.priceCents / 100)}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {mixed ? <p className="text-sm text-late">A bundle can only group listings from one supplier.</p> : null}
          {slow ? (
            <p className="text-sm text-late">
              A piece in this bundle ships in more than {DELIVERY_WARN_BUSINESS_DAYS} business days.
            </p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            Page id
            <Input value={productId} maxLength={80} onChange={(event) => setProductId(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            SKU
            <Input value={sku} maxLength={40} onChange={(event) => setSku(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Title
            <Input value={title} maxLength={180} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Description
            <Textarea value={description} maxLength={4000} rows={3} onChange={(event) => setDescription(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Bundle price
            <Input value={price} inputMode="decimal" placeholder="0.00" onChange={(event) => setPrice(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Aisle
            <select value={aisle} onChange={(event) => setAisle(event.target.value)} className="h-9 border bg-background px-2">
              <option value="">Leave unset</option>
              {aisles.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          {message ? <p className="text-sm">{message}</p> : null}
          <Button type="button" variant="outline" className="w-fit" disabled={pending || mixed || picked.length < 2} onClick={save}>
            {pending ? "Saving…" : "Save the bundle"}
          </Button>
        </div>
      )}
    </section>
  );
}
