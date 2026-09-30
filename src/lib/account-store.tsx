"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { planStatus, trialDaysLeft, type Account, type PlanStatus } from "./account";
import type { PayoutOnFile } from "./payout";

type AccountApi = {
  ready: boolean;
  account: Account | null;
  status: PlanStatus | null;
  daysLeft: number;
  payout: PayoutOnFile | null;
  billing: boolean;
  signUp: (input: { name: string; email: string; password: string }) => Promise<string | null>;
  signIn: (input: { email: string; password: string }) => Promise<string | null>;
  signOut: () => void;
  stopMembership: () => Promise<void>;
  savePayout: (input: Record<string, string>) => Promise<string | null>;
  refresh: () => Promise<void>;
};

const AccountContext = createContext<AccountApi | null>(null);

async function readError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? "The account service did not answer.";
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [payout, setPayout] = useState<PayoutOnFile | null>(null);
  const [billing, setBilling] = useState(false);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account");
    if (!response.ok) {
      setAccount(null);
      setPayout(null);
      return;
    }
    const data = (await response.json()) as {
      account: Account | null;
      payout: PayoutOnFile | null;
      billing?: boolean;
    };
    setAccount(data.account);
    setPayout(data.payout);
    setBilling(Boolean(data.billing));
  }, []);

  useEffect(() => {
    let cancel = false;
    refresh()
      .catch(() => {
        if (!cancel) setAccount(null);
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [refresh]);

  const status = account ? planStatus(account) : null;
  const daysLeft = account ? trialDaysLeft(account) : 0;

  const api = useMemo<AccountApi>(
    () => ({
      ready,
      account,
      status,
      daysLeft,
      payout,
      billing,
      refresh,
      signUp: async ({ name, email, password }) => {
        const response = await fetch("/api/account/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        if (!response.ok) return readError(response);
        await refresh();
        return null;
      },
      signIn: async ({ email, password }) => {
        const response = await fetch("/api/account/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!response.ok) return readError(response);
        await refresh();
        return null;
      },
      signOut: () => {
        void fetch("/api/account/signout", { method: "POST" }).finally(() => {
          setAccount(null);
          setPayout(null);
        });
      },
      stopMembership: async () => {
        await fetch("/api/billing/cancel", { method: "POST" });
        await refresh();
      },
      savePayout: async (input) => {
        const response = await fetch("/api/account/payout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        if (!response.ok) return readError(response);
        const data = (await response.json()) as { payout: PayoutOnFile };
        setPayout(data.payout);
        return null;
      },
    }),
    [ready, account, status, daysLeft, payout, billing, refresh],
  );

  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
