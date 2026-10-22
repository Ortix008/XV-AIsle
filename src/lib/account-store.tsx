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
import type { Account } from "./account";
import type { SignupFeedback } from "./signup-feedback";

export type ConnectState = {
  stripeAccountId: string;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: string;
  transfersStatus: string;
};

export type ReserveRelease = {
  orderId: string;
  amountCents: number;
  releaseAt: number | null;
  blocked: boolean;
};

export type ReserveState = {
  heldCents: number;
  bps: number;
  days: number;
  capCents: number;
  releases: ReserveRelease[];
};

type AccountApi = {
  ready: boolean;
  account: Account | null;
  connect: ConnectState | null;
  sellerLedger: boolean;
  reserve: ReserveState | null;
  signUp: (input: { name: string; email: string; password: string; confirmPassword: string }) => Promise<SignupFeedback>;
  totpChallenge: string | null;
  signIn: (input: { email: string; password: string }) => Promise<string | null>;
  submitTotp: (code: string) => Promise<string | null>;
  signOut: () => void;
  chooseRole: (role: "reseller" | "supplier") => Promise<string | null>;
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
  const [connect, setConnect] = useState<ConnectState | null>(null);
  const [sellerLedger, setSellerLedger] = useState(false);
  const [reserve, setReserve] = useState<ReserveState | null>(null);
  const [totpChallenge, setTotpChallenge] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account");
    if (!response.ok) {
      setAccount(null);
      setConnect(null);
      setSellerLedger(false);
      setReserve(null);
      return;
    }
    const data = (await response.json()) as {
      account: Account | null;
      connect: ConnectState | null;
      sellerLedger?: boolean;
      reserve?: ReserveState | null;
    };
    setAccount(data.account);
    setConnect(data.connect);
    setSellerLedger(data.sellerLedger === true);
    setReserve(data.reserve ?? null);
  }, []);

  useEffect(() => {
    let cancel = false;
    fetch("/api/account")
      .then(async (response) => {
        if (cancel) return;
        if (!response.ok) {
          setAccount(null);
          setConnect(null);
          setSellerLedger(false);
          setReserve(null);
          return;
        }
        const data = (await response.json()) as {
          account: Account | null;
          connect: ConnectState | null;
          sellerLedger?: boolean;
          reserve?: ReserveState | null;
        };
        if (cancel) return;
        setAccount(data.account);
        setConnect(data.connect);
        setSellerLedger(data.sellerLedger === true);
        setReserve(data.reserve ?? null);
      })
      .catch(() => {
        if (!cancel) setAccount(null);
      })
      .finally(() => {
        if (!cancel) setReady(true);
      });
    return () => {
      cancel = true;
    };
  }, []);

  const api = useMemo<AccountApi>(
    () => ({
      ready,
      account,
      connect,
      sellerLedger,
      reserve,
      totpChallenge,
      refresh,
      signUp: async ({ name, email, password, confirmPassword }) => {
        const response = await fetch("/api/account/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password, confirmPassword }),
        });
        if (!response.ok) return { kind: "error", message: await readError(response) };
        const data = (await response.json().catch(() => null)) as { message?: string; notice?: boolean } | null;
        await refresh();
        if (data?.notice === true) return { kind: "notice", message: data.message ?? "" };
        return { kind: "error", message: data?.message ?? "The account service did not answer." };
      },
      signIn: async ({ email, password }) => {
        const response = await fetch("/api/account/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = (await response.json().catch(() => null)) as {
          error?: string;
          totpRequired?: boolean;
          challenge?: string;
        } | null;
        if (!response.ok) return data?.error ?? "The account service did not answer.";
        if (data?.totpRequired && data.challenge) {
          setTotpChallenge(data.challenge);
          return null;
        }
        setTotpChallenge(null);
        await refresh();
        return null;
      },
      submitTotp: async (code) => {
        if (!totpChallenge) return "Enter your password again.";
        const response = await fetch("/api/account/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challenge: totpChallenge, code }),
        });
        if (!response.ok) return readError(response);
        setTotpChallenge(null);
        await refresh();
        return null;
      },
      signOut: () => {
        void fetch("/api/account/signout", { method: "POST" }).finally(() => {
          setAccount(null);
          setConnect(null);
          setReserve(null);
        });
      },
      chooseRole: async (role) => {
        const response = await fetch("/api/account/role", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
        if (!response.ok) return readError(response);
        await refresh();
        return null;
      },
    }),
    [ready, account, connect, sellerLedger, reserve, totpChallenge, refresh],
  );

  return <AccountContext.Provider value={api}>{children}</AccountContext.Provider>;
}

export function useOptionalAccount() {
  return useContext(AccountContext);
}

export function useAccount() {
  const value = useOptionalAccount();
  if (!value) throw new Error("useAccount must be used inside AccountProvider");
  return value;
}
