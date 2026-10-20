"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { JoinScreen } from "@/components/home-screen";
import { BrandMark } from "@/components/brand-mark";
import { botIcon } from "@/components/bot-mark";
import { Switch } from "@/components/ui/switch";
import { useAccount } from "@/lib/account-store";
import type { AccountRole } from "@/lib/account";
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

const memberLinks = [
  { href: "/orders", label: "Orders" },
  { href: "/account", label: "Profile" },
];

const operatorPaths = new Set(["/desk", "/scout", "/listings", "/marketing", "/floors", "/catalog"]);

function isOperator(role: AccountRole) {
  return role === "admin";
}

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready: accountReady, account, signOut } = useAccount();
  const { ready, state } = useDesk();
  const latest = state.log[0];
  const anyRunning = bots.some((bot) => state.bots[bot.id].running);

  if (pathname === "/") return <>{children}</>;

  if (!accountReady || !ready) {
    return (
      <div className="grid h-dvh place-items-center bg-background px-6 text-sm text-muted-foreground">
        Opening the market…
      </div>
    );
  }

  if (!account) return operatorPaths.has(pathname) ? <SendHome /> : <JoinScreen />;

  const operator = isOperator(account.role);
  if (!operator && operatorPaths.has(pathname)) return <SendHome />;
  const desk = operator || !operatorPaths.has(pathname) ? children : <DeskGate />;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <a
        href="#desk-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2 focus:text-sm"
      >
        {operator ? "Skip to the market" : "Skip to content"}
      </a>
      <header className="flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-border bg-[#07080a]/90 px-4 backdrop-blur-[14px] text-foreground">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <BrandMark />
        </Link>
        <div className="flex items-center gap-4">
          <p className="hidden text-xs text-muted-foreground md:block">The first US trend market</p>
          <Link
            href="/shop"
            className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:shadow-[0_0_24px_rgba(61,220,132,0.45)]"
          >
            Shop
          </Link>
          <Link href="/account" className="text-xs text-muted-foreground hover:text-foreground">
            Account
          </Link>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground md:hidden"
            onClick={signOut}
          >
            Sign out
          </button>
        </div>
      </header>
      {operator ? (
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
              "The SI Team is quiet. Ask them to work when you are ready."
            )}
          </p>
        </div>
      ) : null}
      <PhoneTabRow label={operator ? "Desk" : "Account"}>
        {operator ? (
          <>
            <DeskLink href="/desk" pathname={pathname} mobile>
              Market
            </DeskLink>
            <DeskLink href="/shop" pathname={pathname} mobile>
              Shop
            </DeskLink>
            <DeskLink href="/account" pathname={pathname} mobile>
              Account
            </DeskLink>
            <DeskLink href="/floors" pathname={pathname} mobile>
              Floors
            </DeskLink>
            <PendingCatalogLink pathname={pathname} mobile />
            <NavLinks pathname={pathname} mobile />
          </>
        ) : (
          memberLinks.map((item) => (
            <DeskLink key={item.href} href={item.href} pathname={pathname} mobile>
              {item.label}
            </DeskLink>
          ))
        )}
      </PhoneTabRow>
      <div className="flex min-h-0 flex-1">
        <nav className="hidden w-52 shrink-0 flex-col border-r bg-card md:flex">
          <div className="px-2 pt-3">
            {operator ? (
              <>
                <DeskLink href="/desk" pathname={pathname}>
                  Market
                </DeskLink>
                <DeskLink href="/shop" pathname={pathname}>
                  Shop
                </DeskLink>
                <DeskLink href="/account" pathname={pathname}>
                  Account
                </DeskLink>
                <DeskLink href="/floors" pathname={pathname}>
                  Floors
                </DeskLink>
                <PendingCatalogLink pathname={pathname} />
              </>
            ) : (
              memberLinks.map((item) => (
                <DeskLink key={item.href} href={item.href} pathname={pathname}>
                  {item.label}
                </DeskLink>
              ))
            )}
          </div>
          {operator ? (
            <>
              <p className="px-5 pt-4 pb-1 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground">
                SI Team
              </p>
              <div className="flex flex-col px-2">
                <NavLinks pathname={pathname} showCounts />
              </div>
            </>
          ) : null}
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
        <main
          id="desk-main"
          className={cn(
            "min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-y-contain",
            operator && "lg:overflow-hidden",
          )}
        >
          <div key={pathname} className="page-enter h-full min-h-0">
            {desk}
          </div>
        </main>
      </div>
    </div>
  );
}

function PhoneTabRow({ label, children }: { label: string; children: ReactNode }) {
  const scroller = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => {
      const max = node.scrollWidth - node.clientWidth;
      const overflow = max > 2;
      const start = overflow && node.scrollLeft > 2;
      const end = overflow && node.scrollLeft < max - 2;
      setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    measure();
    node.addEventListener("scroll", measure, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(node);
    return () => {
      node.removeEventListener("scroll", measure);
      observer?.disconnect();
    };
  }, [label]);

  return (
    <div className="relative md:hidden">
      <nav
        ref={scroller}
        className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-2 py-1.5"
        aria-label={label}
      >
        {children}
      </nav>
      <span
        aria-hidden
        data-tab-fade="start"
        data-shown={edges.start ? "true" : "false"}
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-card to-transparent motion-safe:transition-opacity motion-safe:duration-200",
          edges.start ? "opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        data-tab-fade="end"
        data-shown={edges.end ? "true" : "false"}
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-card to-transparent motion-safe:transition-opacity motion-safe:duration-200",
          edges.end ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

function DeskLink({
  href,
  pathname,
  mobile = false,
  children,
}: {
  href: string;
  pathname: string;
  mobile?: boolean;
  children: ReactNode;
}) {
  const active = !href.includes("#") && pathname === href;
  return (
    <Link
      href={href}
      className={cn(
        "whitespace-nowrap text-sm",
        mobile ? "border-b-2 px-3 py-1.5" : "block border-l-2 px-3 py-2",
        active
          ? "border-foreground font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}

function SendHome() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return (
    <div className="grid h-dvh place-items-center bg-background px-6 text-sm text-muted-foreground">
      Opening the market…
    </div>
  );
}

function DeskGate() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <p className="eyebrow">Account</p>
      <h1 className="mt-3 text-3xl">This desk is for the operator.</h1>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">
        Your account shows your orders, your profile, and the reseller program.
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/orders" className="pill pill-primary">
          Orders
        </Link>
        <Link href="/account" className="pill pill-ghost">
          Profile
        </Link>
      </div>
    </div>
  );
}

function PendingCatalogLink({ pathname, mobile = false }: { pathname: string; mobile?: boolean }) {
  const { account } = useAccount();
  if (account?.role !== "admin" || !account.emailVerified || account.totpEnabled !== true) return null;
  const active = pathname === "/catalog";
  return (
    <Link
      href="/catalog"
      className={cn(
        "whitespace-nowrap text-sm",
        mobile ? "border-b-2 px-3 py-1.5" : "block border-l-2 px-3 py-2",
        active
          ? "border-foreground font-medium text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      Pending catalog
    </Link>
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
  const running = state.bots[id].running;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={() => runPass(id)}
        className="text-sm font-medium underline-offset-4 hover:underline"
      >
        Work once
      </button>
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={running}
          onCheckedChange={(checked) => setRunning(id, checked)}
          aria-label={running ? `Stop ${botById(id).name}` : `Keep ${botById(id).name} running`}
          className="bot-live"
        />
        <span>{running ? "Running" : "Keep running"}</span>
      </label>
    </div>
  );
}
