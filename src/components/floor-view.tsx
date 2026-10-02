"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiBadge, botIcon } from "@/components/bot-mark";
import { DepartmentGrid } from "@/components/department-grid";
import { GettingStarted } from "@/components/getting-started";
import { ShopGrid } from "@/components/shop-grid";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getProduct, trendSourceLabel } from "@/lib/catalog";
import { MEMBER_PRICE } from "@/lib/account";
import { useAccount } from "@/lib/account-store";
import { parties, welcomeHero, welcomeReach } from "@/lib/art";
import { bots } from "@/lib/bots";
import { useDesk } from "@/lib/desk-store";
import { prettyDate } from "@/lib/dates";
import type { SelectionKey } from "@/lib/types";

type Decision = {
  id: string;
  href: string;
  key: SelectionKey;
  selectId: string;
  kicker: string;
  title: string;
  detail: string;
};

export function FloorView() {
  const { state, setRunning, reset, select } = useDesk();
  const { status } = useAccount();
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);

  const review = state.pipeline.filter((item) => item.status === "review");
  const approved = state.pipeline.filter((item) => item.status === "approved");
  const readyListings = state.listings.filter((listing) => listing.status === "ready");
  const approvedPosts = state.campaigns.reduce(
    (sum, campaign) => sum + campaign.posts.filter((post) => post.status === "approved").length,
    0,
  );

  const decisions: Decision[] = [];
  for (const item of review) {
    const product = getProduct(item.productId);
    decisions.push({
      id: `review-${item.productId}`,
      href: "/scout",
      key: "scout",
      selectId: item.productId,
      kicker: "Signal",
      title: product.titleLead,
      detail: `${trendSourceLabel(product.trend.platform)} · ${product.trend.title}`,
    });
  }
  for (const item of approved) {
    if (state.listings.some((listing) => listing.productId === item.productId)) continue;
    const product = getProduct(item.productId);
    decisions.push({
      id: `wait-${item.productId}`,
      href: "/listings",
      key: "listing",
      selectId: item.productId,
      kicker: "Draft",
      title: `Write a page for ${product.titleLead}`,
      detail: "You said yes. The page is not written yet.",
    });
  }
  for (const listing of state.listings) {
    if (listing.status !== "draft") continue;
    const product = getProduct(listing.productId);
    decisions.push({
      id: `draft-${listing.productId}`,
      href: "/listings",
      key: "listing",
      selectId: listing.productId,
      kicker: "Draft",
      title: `Read the page for ${product.titleLead}`,
      detail: "Read it, then mark it ready.",
    });
  }
  for (const order of state.orders) {
    if (!order.flag || order.reply?.status === "approved") continue;
    decisions.push({
      id: `order-${order.id}`,
      href: "/orders",
      key: "order",
      selectId: order.id,
      kicker: "Harbor",
      title: `${order.number} · ${order.customer}`,
      detail:
        order.flag === "quality"
          ? "Something arrived damaged. A reply is ready for you."
          : "This order is late. A reply is ready for you.",
    });
  }
  for (const listing of readyListings) {
    if (state.campaigns.some((campaign) => campaign.productId === listing.productId)) continue;
    const product = getProduct(listing.productId);
    decisions.push({
      id: `camp-${listing.productId}`,
      href: "/marketing",
      key: "marketing",
      selectId: listing.productId,
      kicker: "Cast",
      title: `Write a post for ${product.titleLead}`,
      detail: "The page is ready. The post is not written yet.",
    });
  }
  for (const campaign of state.campaigns) {
    const pending = campaign.posts.filter((post) => post.status === "draft").length;
    if (pending === 0) continue;
    const product = getProduct(campaign.productId);
    decisions.push({
      id: `posts-${campaign.productId}`,
      href: "/marketing",
      key: "marketing",
      selectId: campaign.productId,
      kicker: "Cast",
      title: product.titleLead,
      detail: pending === 1 ? "1 post is waiting for you." : `${pending} posts are waiting for you.`,
    });
  }

  const stages = [
    { label: "To review", count: review.length },
    { label: "You said yes", count: approved.length },
    { label: "Pages ready", count: readyListings.length },
    { label: "Posts ready", count: approvedPosts },
  ];

  return (
    <div className="lg:h-full lg:overflow-y-auto lg:overscroll-y-contain">
      <div className="relative h-64 sm:h-80">
        <Image
          src={welcomeHero}
          alt="Two people at a kitchen counter with a sheet pan, towels, and a phone."
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 sm:px-6">
          <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">
            Market
          </p>
          <h1 className="mt-1 max-w-xl text-balance text-[1.75rem] leading-tight font-semibold tracking-tight text-white sm:text-4xl">
            The first US trend market that keeps it.
          </h1>
        </div>
      </div>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
        <GettingStarted />
        <div>
          <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
            You sell what people already want. A supplier in the US ships it. You never hold the box.
            The SI Team finds the product, writes the page, watches the order, and drafts a post.
            You still say yes before anything goes out. Share your shop link anywhere. Buyers pay on xvaisle.com.
          </p>
          {status === "trial" ? (
            <p className="mt-3 max-w-2xl text-pretty text-sm">
              The first 30 days are free. Ask the SI Team to work when you are ready. After that, leaving them on is $
              {MEMBER_PRICE} a month.
            </p>
          ) : null}
          <p className="mt-3 text-sm">
            <Link href="/shop" className="underline underline-offset-4">
              Open the store
            </Link>
            <span className="text-muted-foreground"> — a ready page is what a buyer can pay for.</span>
          </p>
        </div>
      </div>
      <ShopGrid
        kicker="Store"
        title="In the store now"
        lede="Ready pages a buyer can pay for."
        query=""
        empty="Nothing is marked ready yet."
        limit={8}
        seeAllHref="/shop"
      />
      <div className="mx-auto max-w-5xl px-4 pb-2 sm:px-6">
        <section aria-label="Departments">
          <h2 className="text-sm font-medium">Departments</h2>
        </section>
      </div>
      <DepartmentGrid />
      <section className="border-t [content-visibility:auto] [contain-intrinsic-size:auto_520px]">
        <div className="px-4 py-4 sm:px-6">
          <h2 className="text-sm font-medium">Who ships</h2>
          <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">
            Local shops and big floors both get the order in front of more people.
          </p>
        </div>
        <ul className="grid gap-px bg-border md:grid-cols-2">
          {welcomeReach.map((place) => (
            <li key={place.title} className="relative aspect-[16/10] bg-card">
              <Image src={place.src} alt="" fill sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-black/75 px-4 py-3 sm:px-5">
                <p className="text-sm font-medium text-white">{place.title}</p>
                <p className="max-w-md text-pretty text-xs text-white/80">{place.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 [content-visibility:auto] [contain-intrinsic-size:auto_900px]">
        <section aria-label="Who this helps">
          <h2 className="text-sm font-medium">Everyone keeps a piece</h2>
          <ul className="mt-3 grid gap-6 sm:grid-cols-3">
            {parties.map((party) => (
              <li key={party.title}>
                <h3 className="text-sm font-medium">{party.title}</h3>
                <div className="relative mt-2 aspect-[4/3] bg-card">
                  <Image
                    src={party.src}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 30vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <p className="mt-2 text-pretty text-sm text-muted-foreground">{party.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="Pipeline">
          <ol className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
            {stages.map((stage) => (
              <li key={stage.label} className="bg-card px-4 py-4">
                <p className="font-mono text-2xl tabular-nums">{stage.count}</p>
                <p className="text-xs text-muted-foreground">{stage.label}</p>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            {state.queue.length > 0 ? `${state.queue.length} products still in the pile. ` : null}
            Started {prettyDate(state.startedOn)}.
          </p>
        </section>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <section>
            <h2 className="text-sm font-medium">Waiting on you</h2>
            {decisions.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nothing is waiting on you yet.
              </p>
            ) : (
              <ul className="mt-2 divide-y border-y">
                {decisions.map((decision) => (
                  <li key={decision.id}>
                    <button
                      type="button"
                      className="flex w-full flex-col items-start gap-0.5 py-3 text-left hover:bg-muted/60"
                      onClick={() => {
                        select(decision.key, decision.selectId);
                        router.push(decision.href);
                      }}
                    >
                      <span className="flex items-center gap-2 text-base text-[#2c3036]">
                        {decision.kicker}
                      </span>
                      <span className="text-sm font-medium">{decision.title}</span>
                      <span className="text-sm text-muted-foreground">{decision.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">SI Team</h2>
            <p className="mt-2 text-base leading-relaxed text-[#2c3036]">
              These are AI tools, not people. You still say yes before anything goes out.
            </p>
            <ul className="mt-2 divide-y border-y">
              {bots.map((bot) => {
                const running = state.bots[bot.id].running;
                const Icon = botIcon(bot.id);
                return (
                  <li key={bot.id} className="flex items-start gap-3 py-3">
                    <span className="grid size-12 shrink-0 place-items-center border border-[#1a1a1a] bg-[#f4f5f7]">
                      <Icon aria-hidden className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-base font-medium">
                        {bot.name}
                        <AiBadge />
                      </p>
                      <p className="text-base leading-relaxed text-[#1a1a1a]">{bot.does}</p>
                      <p className="text-base leading-relaxed text-[#2c3036]">{bot.job}</p>
                    </div>
                    {status === "member" ? (
                      <label className="flex shrink-0 items-center gap-2 pt-0.5 text-xs">
                        <Switch
                          checked={running}
                          onCheckedChange={(checked) => setRunning(bot.id, checked)}
                          aria-label={`${running ? "Stop" : "Start"} ${bot.name}`}
                          className="bot-live"
                        />
                        <span className="w-14">{running ? "Running" : "Off"}</span>
                      </label>
                    ) : (
                      <Link href="/membership" className="shrink-0 pt-1 text-xs text-muted-foreground underline-offset-4 hover:underline">
                        Members
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <section className="border-t pt-4">
          <h2 className="text-sm font-medium">What they just did</h2>
          {state.log.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Nothing yet. Leave the SI Team on, or ask them to look.</p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {state.log.slice(0, 8).map((line) => (
                <li key={line.id} className="text-[13px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {bots.find((bot) => bot.id === line.bot)?.name}
                  </span>
                  <span className="text-border"> · </span>
                  {line.text}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 flex items-center gap-3">
            {confirmReset ? (
              <>
                <p className="text-sm">This empties the desk on this browser.</p>
                <Button type="button" variant="destructive" size="sm" onClick={() => reset()}>
                  Confirm reset
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
                Start over
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
