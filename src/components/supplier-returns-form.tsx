"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/lib/account-store";

type SupplierChoice = {
  key: string;
  label: string;
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
};

const empty = { line1: "", city: "", region: "", postal: "", country: "" };

function ReturnFields({
  line1,
  city,
  region,
  postal,
  country,
}: {
  line1: string;
  city: string;
  region: string;
  postal: string;
  country: string;
}) {
  return (
    <>
      <label className="flex flex-col gap-1 text-sm">
        Street
        <Input name="line1" defaultValue={line1} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        City
        <Input name="city" defaultValue={city} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        State
        <Input name="region" defaultValue={region} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ZIP
        <Input name="postal" defaultValue={postal} autoComplete="off" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Country
        <Input name="country" defaultValue={country} autoComplete="off" />
      </label>
    </>
  );
}

export function SupplierReturnsForm() {
  const [suppliers, setSuppliers] = useState<SupplierChoice[]>([]);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch("/api/store/returns")
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { suppliers?: SupplierChoice[] };
        if (ignore) return;
        const list = data.suppliers ?? [];
        setSuppliers(list);
        setKey((current) => current || list[0]?.key || "");
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);

  const selected = suppliers.find((item) => item.key === key);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/store/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierKey: key,
        line1: String(form.get("line1") ?? ""),
        city: String(form.get("city") ?? ""),
        region: String(form.get("region") ?? ""),
        postal: String(form.get("postal") ?? ""),
        country: String(form.get("country") ?? ""),
      }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string; suppliers?: SupplierChoice[] } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "That address did not save.");
      return;
    }
    setSuppliers(data?.suppliers ?? []);
    setSaved("Saved. The buyer sees this address on the order page after they pay.");
  }

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
      <h2 className="text-sm font-medium text-foreground">Supplier return addresses</h2>
      <p className="text-sm text-muted-foreground">
        Returns go back to that supplier. Use the supplier&apos;s business address, not a home address. PO Boxes are not
        accepted. The street stays off the product page.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Supplier
        <select value={key} onChange={(event) => setKey(event.target.value)} className="h-9 border bg-background px-2">
          {suppliers.length === 0 ? <option value="">No suppliers yet</option> : null}
          {suppliers.map((supplier) => (
            <option key={supplier.key} value={supplier.key}>
              {supplier.label}
            </option>
          ))}
        </select>
      </label>
      <ReturnFields
        key={key}
        line1={selected?.line1 ?? ""}
        city={selected?.city ?? ""}
        region={selected?.region ?? ""}
        postal={selected?.postal ?? ""}
        country={selected?.country ?? ""}
      />
      {error ? <p className="text-sm text-late">{error}</p> : null}
      {saved ? <p className="text-sm">{saved}</p> : null}
      <Button type="submit" disabled={pending || !key} className="w-fit">
        {pending ? "Saving…" : "Save supplier return address"}
      </Button>
    </form>
  );
}

export function ProductReturnForm({ productId }: { productId: string }) {
  const { account } = useAccount();
  const [address, setAddress] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const admin = account?.role === "admin" && account.emailVerified === true;
  useEffect(() => {
    if (!admin) return;
    let ignore = false;
    fetch(`/api/store/listings/${encodeURIComponent(productId)}/return`)
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as typeof empty;
        if (ignore) return;
        setAddress({
          line1: data.line1 ?? "",
          city: data.city ?? "",
          region: data.region ?? "",
          postal: data.postal ?? "",
          country: data.country ?? "",
        });
      })
      .catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, [admin, productId]);
  if (account?.role !== "admin") return null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(null);
    const response = await fetch(`/api/store/listings/${encodeURIComponent(productId)}/return`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });
    const data = (await response.json().catch(() => null)) as ({ error?: string } & typeof empty) | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "That address did not save.");
      return;
    }
    setAddress({
      line1: data?.line1 ?? "",
      city: data?.city ?? "",
      region: data?.region ?? "",
      postal: data?.postal ?? "",
      country: data?.country ?? "",
    });
    setSaved(data?.line1 ? "This product uses its own return address." : "Cleared. This product uses the supplier address.");
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-3 border-t pt-4">
      <h3 className="text-sm font-medium">Return address for this product</h3>
      <p className="text-pretty text-xs text-muted-foreground">
        Optional. A filled address replaces the supplier&apos;s address for this product only. Leave every field blank
        to use the supplier address. Use a business street, not a home address or a PO Box.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Street
        <Input value={address.line1} autoComplete="off" onChange={(event) => setAddress({ ...address, line1: event.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        City
        <Input value={address.city} autoComplete="off" onChange={(event) => setAddress({ ...address, city: event.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        State
        <Input value={address.region} autoComplete="off" onChange={(event) => setAddress({ ...address, region: event.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        ZIP
        <Input value={address.postal} autoComplete="off" onChange={(event) => setAddress({ ...address, postal: event.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Country
        <Input value={address.country} autoComplete="off" onChange={(event) => setAddress({ ...address, country: event.target.value })} />
      </label>
      {error ? <p className="text-sm text-late">{error}</p> : null}
      {saved ? <p className="text-sm">{saved}</p> : null}
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "Saving…" : "Save product return address"}
      </Button>
    </form>
  );
}
