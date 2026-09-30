"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DepartmentGrid } from "@/components/department-grid";
import { welcomeHero, welcomeReach, welcomeTeam } from "@/lib/art";
import { bots } from "@/lib/bots";
import { MEMBER_PRICE } from "@/lib/account";
import { PayMembership } from "@/components/pay-membership";
import { PayoutForm } from "@/components/payout-form";
import { useAccount } from "@/lib/account-store";

const pulse = [
  { who: "Signal", text: "Filed a quarter sheet pan. It is already in a US warehouse." },
  { who: "Draft", text: "Wrote the canvas apron page. It is waiting to be read." },
  { who: "Harbor", text: "An order is late. The reply is sitting here for a yes." },
  { who: "Cast", text: "Wrote a social post. Nothing has been published." },
];

function TeamColumn() {
  return (
    <aside className="bg-card lg:border-l">
      <div className="px-4 py-4 sm:px-5">
        <h2 className="text-sm font-medium">SI Team</h2>
        <p className="mt-1 text-pretty text-sm text-muted-foreground">
          They find the product, write the page, watch the order, and write the social posts. You
          still say yes.
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-px border-t bg-border">
        {bots.map((member) => (
          <li key={member.id} className="bg-card">
            <div className="relative aspect-square">
              <Image
                src={welcomeTeam[member.id]}
                alt=""
                fill
                sizes="(min-width: 1024px) 18vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="px-3 py-3">
              <p className="text-sm font-medium">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.does}</p>
              <p className="mt-1 text-pretty text-xs text-muted-foreground">{member.job}</p>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function JoinScreen() {
  const { signUp, signIn } = useAccount();
  const [mode, setMode] = useState<"join" | "sign-in">("join");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [beat, setBeat] = useState(0);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    const message =
      mode === "join"
        ? await signUp({ name, email, password })
        : await signIn({ email, password });
    setError(message);
    setPending(false);
  }

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const timer = window.setInterval(() => setBeat((current) => (current + 1) % pulse.length), 3800);
    return () => window.clearInterval(timer);
  }, []);

  const line = pulse[beat];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-[#111] px-4 text-white">
        <div className="flex items-center">
          <span className="grid h-7 w-8 place-items-center bg-live text-[11px] font-semibold tracking-tight text-[#111]">
            XV
          </span>
          <span className="ml-2.5 text-sm font-semibold tracking-[0.22em]">AISLE</span>
        </div>
        <p className="hidden text-xs text-white/55 sm:block">A US trend market</p>
      </header>
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <span className="size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
        <p className="truncate text-[13px] text-muted-foreground">
          <span className="font-medium text-foreground">{line.who}</span>
          <span className="text-border"> · </span>
          {line.text}
        </p>
      </div>
      <div className="lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <div>
          <div className="relative h-52 sm:h-64 lg:h-72">
            <Image
              src={welcomeHero}
              alt="Two people at a kitchen counter with a sheet pan, towels, and a phone."
              fill
              priority
              sizes="(min-width: 1024px) 58vw, 100vw"
              className="object-cover object-[center_40%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/10" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-5 sm:px-10">
              <p className="text-[11px] font-semibold tracking-[0.18em] text-white/70 uppercase">
                {mode === "join" ? "Welcome" : "Welcome back"}
              </p>
              <h1 className="mt-1 max-w-xl text-balance text-[1.85rem] leading-tight font-semibold tracking-tight text-white sm:text-4xl">
                {mode === "join" ? "Marketing that keeps working." : "The market is where you left it."}
              </h1>
            </div>
          </div>
          <div className="px-5 py-6 sm:px-10">
            {mode === "join" ? (
              <>
                <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                  Dropshipping stays simple. Someone else keeps the stock and ships the box. The SI
                  Team finds what people already want, writes the page, watches the order, and
                  writes the social posts. You still say yes. The work is prepared. The decision
                  stays yours.
                </p>
                <p className="mt-3 max-w-xl text-pretty text-sm">
                  The first month is free, so you can watch it work. Then membership is $
                  {MEMBER_PRICE} a month. If you do not continue, the account remains and the market
                  stops.
                </p>
              </>
            ) : (
              <p className="max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                Sign in and the market opens again. The first month is free. After that, membership
                is ${MEMBER_PRICE} a month.
              </p>
            )}
            <form onSubmit={onSubmit} className="mt-6 flex max-w-sm flex-col gap-3">
              {mode === "join" ? (
                <label className="flex flex-col gap-1 text-sm">
                  Your name
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    required
                  />
                </label>
              ) : null}
              <label className="flex flex-col gap-1 text-sm">
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                Password
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "join" ? "new-password" : "current-password"}
                    required
                    minLength={8}
                    maxLength={128}
                />
              </label>
              {error ? <p className="text-sm text-late">{error}</p> : null}
              <Button type="submit" disabled={pending} className="mt-1 w-fit">
                {mode === "join" ? "Join the market" : "Sign in"}
              </Button>
              <button
                type="button"
                className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => {
                  setMode(mode === "join" ? "sign-in" : "join");
                  setError(null);
                }}
              >
                {mode === "join" ? "I already have an account" : "Create an account"}
              </button>
            </form>
            <p className="mt-6 max-w-md text-xs text-pretty text-muted-foreground">
              The account is kept on the server for this market. The desk you work stays in this browser.
            </p>
          </div>
        </div>
        <TeamColumn />
      </div>
      <section className="border-t">
        <div className="px-5 py-4 sm:px-10">
          <h2 className="text-sm font-medium">Departments</h2>
        </div>
        <DepartmentGrid />
      </section>
      <section className="border-t">
        <div className="px-5 py-4 sm:px-10">
          <h2 className="text-sm font-medium">Who ships</h2>
          <p className="mt-1 max-w-xl text-pretty text-sm text-muted-foreground">
            Local shops and big floors both get the order in front of more people.
          </p>
        </div>
        <ul className="grid gap-px bg-border md:grid-cols-2">
          {welcomeReach.map((place) => (
            <li key={place.title} className="relative aspect-[16/10] bg-card">
              <Image
                src={place.src}
                alt=""
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/75 px-4 py-3 sm:px-5">
                <p className="text-sm font-medium text-white">{place.title}</p>
                <p className="max-w-md text-pretty text-xs text-white/80">{place.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function ClosedScreen() {
  const { signOut } = useAccount();
  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between bg-[#111] px-4 text-white">
        <div className="flex items-center">
          <span className="grid h-7 w-8 place-items-center bg-live text-[11px] font-semibold tracking-tight text-[#111]">
            XV
          </span>
          <span className="ml-2.5 text-sm font-semibold tracking-[0.22em]">AISLE</span>
        </div>
        <button type="button" className="text-xs text-white/70 hover:text-white" onClick={signOut}>
          Sign out
        </button>
      </header>
      <div className="mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col gap-4 overflow-y-auto px-5 py-10">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
          Membership
        </p>
        <h1 className="text-balance text-[1.75rem] leading-tight font-semibold tracking-tight">
          The free month is over.
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          The market stays closed until you keep the account. Membership is ${MEMBER_PRICE} a month
          from here. If you do not continue, the account stays on file and the SI Team stops.
        </p>
        <PayMembership />
        <PayoutForm />
        <button
          type="button"
          className="w-fit text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={signOut}
        >
          Leave it closed
        </button>
      </div>
    </div>
  );
}
