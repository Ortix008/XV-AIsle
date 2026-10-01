"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount } from "./account-store";
import { hydrateAddedProducts } from "./added-stock";
import { getProduct } from "./catalog";
import { todayISO } from "./dates";
import { clipText, deskStorageKey, emptyDesk, purgeOldDesks, sanitizeDesk } from "./desk-state";
import { applyPass, buildCampaign, buildListing } from "./engine";
import type { BotId, DeskState, Listing, SelectionKey } from "./types";

type DeskActions = {
  setRunning: (id: BotId, running: boolean) => void;
  runPass: (id: BotId) => void;
  pickSupplier: (productId: string, supplierId: string) => void;
  setShortlistStatus: (productId: string, status: "review" | "approved" | "passed") => void;
  updateListing: (productId: string, patch: Partial<Listing>) => void;
  setListingStatus: (productId: string, status: Listing["status"]) => void;
  rebuildListing: (productId: string) => void;
  updateReply: (orderId: string, body: string) => void;
  setReplyStatus: (orderId: string, status: "draft" | "approved") => void;
  setPostStatus: (productId: string, postId: string, status: "draft" | "approved") => void;
  writeCampaign: (productId: string) => void;
  select: (key: SelectionKey, id: string) => void;
  reset: () => void;
  hideGettingStarted: () => void;
};

type DeskApi = DeskActions & {
  ready: boolean;
  state: DeskState;
};

const DeskStateContext = createContext<DeskState | null>(null);
const DeskActionsContext = createContext<DeskActions | null>(null);
const DeskReadyContext = createContext(false);

function runningIds(state: DeskState) {
  return (Object.keys(state.bots) as BotId[]).filter((id) => state.bots[id].running);
}

function readStoredDesk(accountId: string) {
  purgeOldDesks(localStorage);
  hydrateAddedProducts(accountId);
  const key = deskStorageKey(accountId);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const parsed = sanitizeDesk(JSON.parse(raw), todayISO());
    if (parsed) return parsed;
  } catch {
    // A bad stored desk is dropped below.
  }
  localStorage.removeItem(key);
  return null;
}

function DeskRuntime({
  accountId,
  boot,
  children,
}: {
  accountId: string | null;
  boot: boolean;
  children: ReactNode;
}) {
  const [state, setState] = useState<DeskState>(() => emptyDesk("2026-01-01"));
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);

  useEffect(() => {
    if (boot) return;
    const timer = window.setTimeout(() => {
      const stored = accountId ? readStoredDesk(accountId) : null;
      setState(stored ?? emptyDesk(todayISO()));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [accountId, boot]);

  useEffect(() => {
    stateRef.current = state;
    if (!ready || !accountId) return;
    const handle = window.setTimeout(() => {
      localStorage.setItem(deskStorageKey(accountId), JSON.stringify(state));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [ready, accountId, state]);

  useEffect(() => {
    if (!ready || !accountId) return;
    const id = accountId;
    return () => {
      // `id` is the account this runtime mounted with, so a switch cannot write into the next account's key.
      localStorage.setItem(deskStorageKey(id), JSON.stringify(stateRef.current));
    };
  }, [ready, accountId]);

  const anyRunning = runningIds(state).length > 0;

  useEffect(() => {
    if (!ready || !anyRunning) return;
    const timer = window.setInterval(() => {
      startTransition(() => {
        setState((current) => {
          const ids = runningIds(current);
          if (ids.length === 0) return current;
          return ids.reduce((next, id) => applyPass(next, id), current);
        });
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [ready, anyRunning]);

  const actions = useMemo<DeskActions>(
    () => ({
      setRunning: (id, running) => {
        setState((current) => ({
          ...current,
          bots: { ...current.bots, [id]: { running } },
        }));
        if (running) {
          window.setTimeout(() => {
            setState((current) => (current.bots[id].running ? applyPass(current, id) : current));
          }, 700);
        }
      },
      runPass: (id) => setState((current) => applyPass(current, id)),
      pickSupplier: (productId, supplierId) =>
        setState((current) => ({
          ...current,
          pipeline: current.pipeline.map((item) =>
            item.productId === productId ? { ...item, pickedSupplierId: supplierId } : item,
          ),
        })),
      setShortlistStatus: (productId, status) =>
        setState((current) => ({
          ...current,
          pipeline: current.pipeline.map((item) =>
            item.productId === productId ? { ...item, status } : item,
          ),
          selected: status === "approved" ? { ...current.selected, listing: productId } : current.selected,
        })),
      updateListing: (productId, patch) =>
        setState((current) => ({
          ...current,
          listings: current.listings.map((listing) => {
            if (listing.productId !== productId) return listing;
            const next = { ...listing, ...patch };
            if (typeof next.description === "string") next.description = clipText(next.description, 8000);
            if (Array.isArray(next.bullets)) {
              next.bullets = next.bullets.slice(0, 12).map((bullet) => clipText(String(bullet), 400));
            }
            if (Array.isArray(next.tags)) {
              next.tags = next.tags.slice(0, 13).map((tag) => clipText(String(tag), 40));
            }
            return next;
          }),
        })),
      setListingStatus: (productId, status) =>
        setState((current) => ({
          ...current,
          listings: current.listings.map((listing) =>
            listing.productId === productId ? { ...listing, status } : listing,
          ),
          selected: status === "ready" ? { ...current.selected, marketing: productId } : current.selected,
        })),
      rebuildListing: (productId) =>
        setState((current) => {
          const item = current.pipeline.find((entry) => entry.productId === productId);
          if (!item) return current;
          const fresh = buildListing(getProduct(productId), todayISO(), item.pickedSupplierId);
          const existing = current.listings.some((listing) => listing.productId === productId);
          return {
            ...current,
            listings: existing
              ? current.listings.map((listing) => (listing.productId === productId ? fresh : listing))
              : [fresh, ...current.listings],
          };
        }),
      updateReply: (orderId, body) =>
        setState((current) => ({
          ...current,
          orders: current.orders.map((order) =>
            order.id === orderId && order.reply
              ? { ...order, reply: { ...order.reply, body: clipText(body, 8000), status: "draft" } }
              : order,
          ),
        })),
      setReplyStatus: (orderId, status) =>
        setState((current) => ({
          ...current,
          orders: current.orders.map((order) =>
            order.id === orderId && order.reply ? { ...order, reply: { ...order.reply, status } } : order,
          ),
        })),
      writeCampaign: (productId) =>
        setState((current) => {
          const listing = current.listings.find((item) => item.productId === productId);
          if (!listing || listing.status !== "ready") return current;
          if (current.campaigns.some((campaign) => campaign.productId === productId)) return current;
          return {
            ...current,
            campaigns: [buildCampaign(getProduct(productId), listing), ...current.campaigns],
            selected: { ...current.selected, marketing: productId },
          };
        }),
      setPostStatus: (productId, postId, status) =>
        setState((current) => ({
          ...current,
          campaigns: current.campaigns.map((campaign) =>
            campaign.productId === productId
              ? {
                  ...campaign,
                  posts: campaign.posts.map((post) => (post.id === postId ? { ...post, status } : post)),
                }
              : campaign,
          ),
        })),
      select: (key, id) =>
        setState((current) => ({
          ...current,
          selected: { ...current.selected, [key]: id },
        })),
      reset: () => {
        const next = emptyDesk(todayISO());
        if (accountId) localStorage.setItem(deskStorageKey(accountId), JSON.stringify(next));
        setState(next);
      },
      hideGettingStarted: () => {
        setState((current) => ({ ...current, gettingStartedHidden: true }));
      },
    }),
    [accountId],
  );

  return (
    <DeskReadyContext.Provider value={ready}>
      <DeskStateContext.Provider value={state}>
        <DeskActionsContext.Provider value={actions}>{children}</DeskActionsContext.Provider>
      </DeskStateContext.Provider>
    </DeskReadyContext.Provider>
  );
}

export function DeskProvider({ children }: { children: ReactNode }) {
  const { ready, account } = useAccount();
  if (!ready) return <DeskRuntime accountId={null} boot>{children}</DeskRuntime>;
  return (
    <DeskRuntime key={account?.id ?? "signed-out"} accountId={account?.id ?? null} boot={false}>
      {children}
    </DeskRuntime>
  );
}

export function useDesk(): DeskApi {
  const ready = useContext(DeskReadyContext);
  const state = useContext(DeskStateContext);
  const actions = useContext(DeskActionsContext);
  if (!state || !actions) throw new Error("useDesk must be used inside DeskProvider");
  return { ready, state, ...actions };
}
