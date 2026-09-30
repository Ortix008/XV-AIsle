"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { checkBank, checkCard, checkWallet, payoutLabel, type PayoutMethod } from "@/lib/payout";
import { useAccount } from "@/lib/account-store";
import { cn } from "cn";

const methods: { id: PayoutMethod; label: string }[] = [
  { id: "card", label: "Card" },
  { id: "bank", label: "Bank" },
  { id: "bitcoin", label: "Bitcoin" },
  { id: "dogecoin", label: "Dogecoin" },
];

export function PayoutForm() {
  const { payout, savePayout } = useAccount();
  const [method, setMethod] = useState<PayoutMethod>(payout?.method ?? "card");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState("");
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [routing, setRouting] = useState("");
  const [account, setAccount] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (payout) setMethod(payout.method);
  }, [payout]);

  function clearFields() {
    setName("");
    setNumber("");
    setExpiry("");
    setRouting("");
    setAccount("");
    setAddress("");
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (method === "card") {
      const problem = checkCard({ name, number, expiry });
      if (problem) {
        setError(problem);
        return;
      }
    } else if (method === "bank") {
      const problem = checkBank({ routing, account });
      if (problem) {
        setError(problem);
        return;
      }
    } else {
      const problem = checkWallet(method, address);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setPending(true);
    const message = await savePayout({ method, name, number, expiry, routing, account, address });
    setPending(false);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    clearFields();
  }

  return (
    <form onSubmit={save} className="flex max-w-sm flex-col gap-3 border-t pt-4" autoComplete="off">
      <div>
        <h2 className="text-sm font-medium">Your margin</h2>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          This is where your profit lands. The full card, bank number, or wallet address is checked on the
          server and then dropped. Only the last four digits of a card or bank account are kept.
        </p>
        {payout ? <p className="mt-2 text-sm">On file: {payoutLabel(payout)}</p> : null}
      </div>
      <div className="flex flex-wrap gap-1">
        {methods.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMethod(item.id);
              setError(null);
            }}
            className={cn(
              "rounded-md px-2 py-1 text-sm",
              method === item.id ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {method === "card" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Name on card
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="off"
              maxLength={80}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Card number
            <Input
              value={number}
              onChange={(event) => setNumber(event.target.value)}
              autoComplete="off"
              inputMode="numeric"
              spellCheck={false}
              maxLength={23}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Expiration
            <Input
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              placeholder="MM/YY"
              autoComplete="off"
              inputMode="numeric"
              maxLength={5}
              required
            />
          </label>
        </>
      ) : null}
      {method === "bank" ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            Routing number
            <Input
              value={routing}
              onChange={(event) => setRouting(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={9}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Account number
            <Input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              maxLength={17}
              required
            />
          </label>
        </>
      ) : null}
      {method === "bitcoin" || method === "dogecoin" ? (
        <label className="flex flex-col gap-1 text-sm">
          {method === "bitcoin" ? "Bitcoin address" : "Dogecoin address"}
          <Input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={90}
            required
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-late">{error}</p> : null}
      <Button type="submit" variant="outline" className="w-fit" disabled={pending}>
        {pending ? "Saving…" : "Save profit payout"}
      </Button>
    </form>
  );
}
