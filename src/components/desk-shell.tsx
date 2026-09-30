"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { ClosedScreen, JoinScreen } from "@/components/account-gate";
import { botIcon } from "@/components/bot-mark";
import { Switch } from "@/components/ui/switch";
import { canKeepBotsRunning, MEMBER_PRICE } from "@/lib/account";
import { useAccount } from "@/lib/account-store";
import { botById, bots } from "@/lib/bots";
import { useDesk } from "@/lib/desk-store";
import { cn } from "cn";

function reviewCount(
  id: (typeof bots)[number]["id"],
  state: ReturnType<typeof useDesk>["state"],
) {
  if (id === "scout") return state.pipeline.filter((item) => item.status === "review").length;
  if (id === "listings") {
    const waiting = state.pipeline.filter(
      (item) =>
        item.status === "approved" &&
        !state.listings.some((listing) => listing.productId === item.productId),
    ).length;
    const drafts = state.listings.filter((listing) => listing.status === "draft").length;
    return waiting + drafts;
  }
  if (id === "orders") {
    return state.orders.filter((order) => order.flag && order.reply?.status !== "approved").length;
  }
  const unwritten = state.listings.filter(
    (listing) =>
      listing.status === "ready" &&
      !state.campaigns.some((campaign) => campaign.productId === listing.productId),
  ).length;
  const drafts = state.campaigns.reduce(
    (sum, campaign) => sum + campaign.posts.filter((post) => post.status === "draft").length,
    0,
  );
  return unwritten + drafts;
}

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready: accountReady, account, status, daysLeft, signOut } = useAccount();
  const { ready, state, setRunning } = useDesk();
  const latest = state.log[0];
  const anyRunning = bots.some((bot) => state.bots[bot.id].running);
  const member = canKeepBotsRunning(status ?? "closed");

  useEffect(() => {
    if (!accountReady || !ready || member) return;
    for (const bot of bots) {
      if (state.bots[bot.id].running) setRunning(bot.id, false);
    }
  }, [accountReady, ready, member, setRunning, state.bots]);

  if (!accountReady || !ready) {
    return (
      <div className="grid h-dvh place-items-center bg-background px-6 text-sm text-muted-foreground">
        Opening the market…
      </div>
    );
  }

  if (!account) return <JoinScreen />;
  if (status === "closed") return <ClosedScreen />;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <a
        href="#desk-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to the market
      </a>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-[#111] px-4 text-white">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-7 w-8 shrink-0 place-items-center bg-live text-[11px] font-semibold tracking-tight text-[#111]">
            XV
          </span>
          <span className="text-sm font-semibold tracking-[0.22em]">AISLE</span>
        </Link>
        <div className="flex items-center gap-4">
          <p className="hidden text-xs text-white/55 md:block">The first US trend market</p>
          <Link href="/shop" className="text-xs text-white/80 hover:text-white">
            Store
          </Link>
          <Link href="/membership" className="text-xs text-white/80 hover:text-white">
            {status === "member" ? `Member · $${MEMBER_PRICE}/mo` : `Free month · ${daysLeft}d`}
          </Link>
          <button
            type="button"
            className="text-xs text-white/70 hover:text-white md:hidden"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>
      <div className="flex shrink-0 items-center gap-3 border-b bg-card px-4 py-2">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", anyRunning ? "bg-live" : "bg-border")}
          aria-hidden
        />
        <p className="truncate text-[13px] text-muted-foreground">
          {latest ? (
            <>
              <span className="font-medium text-foreground">{botById(latest.bot).name}</span>
              <span className="text-border"> · </span>
              {latest.text}
            </>
          ) : (
            "The SI Team is quiet. Run a pass when you want them to work."
          )}
        </p>
      </div>
      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-2 py-1.5 md:hidden">
        <Link
          href="/"
          className={cn(
            "border-b-2 px-3 py-1.5 text-sm whitespace-nowrap",
            pathname === "/"
              ? "border-foreground font-medium"
              : "border-transparent text-muted-foreground",
          )}
        >
          Market
        </Link>
        <Link
          href="/membership"
          className={cn(
            "border-b-2 px-3 py-1.5 text-sm whitespace-nowrap",
            pathname === "/membership"
              ? "border-foreground font-medium"
              : "border-transparent text-muted-foreground",
          )}
        >
          Membership
        </Link>
        <Link
          href="/floors"
          className={cn(
            "border-b-2 px-3 py-1.5 text-sm whitespace-nowrap",
            pathname === "/floors"
              ? "border-foreground font-medium"
              : "border-transparent text-muted-foreground",
          )}
        >
          Floors
        </Link>
        <NavLinks pathname={pathname} mobile />
      </nav>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 flex-col border-r bg-card md:flex">
          <div className="px-2 pt-3">
            <Link
              href="/"
              className={cn(
                "block border-l-2 px-3 py-2 text-sm",
                pathname === "/"
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Market
            </Link>
            <Link
              href="/membership"
              className={cn(
                "block border-l-2 px-3 py-2 text-sm",
                pathname === "/membership"
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Membership
            </Link>
            <Link
              href="/floors"
              className={cn(
                "block border-l-2 px-3 py-2 text-sm",
                pathname === "/floors"
                  ? "border-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Floors
            </Link>
          </div>
          <p className="px-5 pt-4 pb-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
            SI Team
          </p>
          <div className="flex flex-col px-2">
            <NavLinks pathname={pathname} showCounts />
          </div>
          <p className="px-5 pt-4 text-xs text-pretty text-muted-foreground">
            Signed in as {account.name}.
          </p>
          <button
            type="button"
            className="mx-5 mt-2 mb-4 w-fit text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={signOut}
          >
            Sign out
          </button>
        </nav>
        <main id="desk-main" className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain lg:overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavLinks({
  pathname,
  showCounts = false,
  mobile = false,
}: {
  pathname: string;
  showCounts?: boolean;
  mobile?: boolean;
}) {
  const { state } = useDesk();
  return (
    <>
      {bots.map((bot) => {
        const active = pathname === bot.href;
        const count = reviewCount(bot.id, state);
        const running = state.bots[bot.id].running;
        const Icon = botIcon(bot.id);
        return (
          <Link
            key={bot.id}
            href={bot.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap text-sm",
              mobile ? "border-b-2 px-3 py-1.5" : "border-l-2 px-3 py-2",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {mobile ? (
              <span
                className={cn("size-1.5 rounded-full", running ? "bg-live" : "bg-border")}
                aria-hidden
              />
            ) : (
              <span className="relative">
                <Icon aria-hidden className="size-6" />
                <span
                  className={cn(
                    "absolute -right-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-card",
                    running ? "bg-live" : "bg-border",
                  )}
                  aria-hidden
                />
              </span>
            )}
            <span>{bot.name}</span>
            {showCounts && count > 0 ? (
              <span
                className={cn(
                  "ml-auto font-mono text-xs tabular-nums",
                  bot.id === "orders" ? "text-late" : "text-muted-foreground",
                )}
              >
                {count}
              </span>
            ) : null}
            {!showCounts && count > 0 ? (
              <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

export function BotControls({ id }: { id: (typeof bots)[number]["id"] }) {
  const { state, setRunning, runPass } = useDesk();
  const { status } = useAccount();
  const running = state.bots[id].running;
  const member = canKeepBotsRunning(status ?? "closed");
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => runPass(id)}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        Run one pass
      </button>
      {member ? (
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={running}
            onCheckedChange={(checked) => setRunning(id, checked)}
            aria-label={running ? `Stop ${botById(id).name}` : `Keep ${botById(id).name} running`}
            className="bot-live"
          />
          <span>{running ? "Running" : "Keep running"}</span>
        </label>
      ) : (
        <Link href="/membership" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          Members can leave this on
        </Link>
      )}
    </div>
  );
}
