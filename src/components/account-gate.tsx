"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AiBadge, botIcon } from "@/components/bot-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DepartmentGrid } from "@/components/department-grid";
import { welcomeHero, welcomeReach } from "@/lib/art";
import { bots } from "@/lib/bots";
import { MEMBER_PRICE } from "@/lib/account";
import { ConnectPayout } from "@/components/connect-payout";
import { PasswordField } from "@/components/password-field";
import { PayMembership } from "@/components/pay-membership";
import { useAccount } from "@/lib/account-store";

const pulse = [
  { who: "Signal", text: "Filed a quarter sheet pan. It is already in a US warehouse." },
  { who: "Draft", text: "Wrote the canvas apron page. It is waiting to be read." },
  { who: "Harbor", text: "An order is late. The reply is sitting here for a yes." },
  { who: "Cast", text: "Wrote a social post. Nothing has been published." },
];

const paths = [
  {
    title: "Sell",
    lede: "You choose products the platform has already approved. You do not buy the stock.",
    steps: [
      "Open an account.",
      "Add a product to your shop and set a price inside the range the platform set.",
      "Share your shop link. The supplier ships the order. Payment stays on xvaisle.com.",
    ],
  },
  {
    title: "Supply",
    lede: "You already hold the goods. The platform decides what can be sold.",
    steps: [
      "Open an account and choose supplier.",
      "Submit the product, the cost, the shipping, and a photo.",
      "Wait for review. Only an approved product can appear in a reseller shop.",
    ],
  },
] as const;

function HowItWorks() {
  return (
    <section className="border-b px-5 py-8 sm:px-10">
      <h2 className="text-xl font-semibold tracking-tight">Two ways in</h2>
      <div className="mt-6 grid gap-8 md:grid-cols-2">
        {paths.map((path) => (
          <div key={path.title}>
            <h3 className="text-lg font-medium">{path.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-[#2c3036]">{path.lede}</p>
            <ol className="mt-4 list-decimal space-y-3 pl-5 text-base leading-relaxed text-[#1a1a1a]">
              {path.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}

function TeamSection() {
  return (
    <section className="border-t bg-card">
      <div className="px-5 py-6 sm:px-10">
        <h2 className="text-xl font-semibold tracking-tight">SI Team</h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#2c3036]">
          These are AI tools. They find a product, write a page, watch an order, and draft a post.
          You still say yes. They are not people.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-px border-t bg-border sm:grid-cols-2">
        {bots.map((member) => {
          const Icon = botIcon(member.id);
          return (
            <li key={member.id} className="bg-card px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center border border-[#1a1a1a] bg-[#f4f5f7]">
                  <Icon aria-hidden className="size-6" />
                </span>
                <div>
                  <p className="text-lg font-medium">{member.name}</p>
                  <AiBadge />
                </div>
              </div>
              <p className="mt-3 text-base leading-relaxed text-[#1a1a1a]">{member.does}</p>
              <p className="mt-1 text-base leading-relaxed text-[#2c3036]">{member.job}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function JoinScreen() {
  const { signUp, signIn, totpChallenge, submitTotp } = useAccount();
  const [mode, setMode] = useState<"join" | "sign-in">("join");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState("");
  const [beat, setBeat] = useState(0);

  const mismatchMessage = "Those passwords do not match.";
  const confirmError =
    mode === "join" && password !== confirmPassword && (confirmPassword.length > 0 || error === mismatchMessage)
      ? mismatchMessage
      : null;
  const staleMismatch = error === mismatchMessage && password === confirmPassword;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (mode === "join" && password !== confirmPassword) {
      setError(mismatchMessage);
      return;
    }
    setPending(true);
    const message = totpChallenge
      ? await submitTotp(code)
      : mode === "join"
        ? await signUp({ name, email, password, confirmPassword })
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
        <p className="hidden text-base text-white sm:block">A US trend market</p>
      </header>
      <div className="flex items-center gap-3 border-b bg-card px-4 py-2">
        <span className="size-1.5 shrink-0 rounded-full bg-live" aria-hidden />
        <p className="truncate text-base text-[#2c3036]">
          <span className="font-medium text-[#1a1a1a]">{line.who}</span>
          <span> · AI assistant · </span>
          {line.text}
        </p>
      </div>
      <div>
          <div className="relative h-64 sm:h-80 lg:h-96">
            <Image
              src={welcomeHero}
              alt="Two people at a kitchen counter with a sheet pan, towels, and a phone."
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_40%]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25" />
            <div className="absolute inset-x-0 bottom-0 px-5 pb-6 sm:px-10">
              <p className="text-base font-semibold tracking-[0.12em] text-white uppercase">
                {mode === "join" ? "Welcome" : "Welcome back"}
              </p>
              <h1 className="mt-2 max-w-3xl text-balance text-[1.85rem] leading-tight font-semibold tracking-tight text-white sm:text-4xl">
                {mode === "join"
                  ? "Sell approved products without holding inventory. Buyers pay on xvaisle.com."
                  : "Welcome back."}
              </h1>
            </div>
          </div>
          {mode === "join" ? <HowItWorks /> : null}
          <div className="px-5 py-8 sm:px-10">
            <p className="max-w-xl text-base leading-relaxed text-[#2c3036]">
              {mode === "join"
                ? `The first month is free. After that, membership is $${MEMBER_PRICE} a month. If you stop, the account stays and the market closes.`
                : `Sign in and the market opens again. The first month is free. After that, membership is $${MEMBER_PRICE} a month.`}
            </p>
            <form onSubmit={onSubmit} className="mt-6 flex max-w-sm flex-col gap-3">
              {totpChallenge ? (
                <label className="flex flex-col gap-1 text-base">
                  Authenticator code
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    required
                    className="h-11 md:text-base"
                  />
                  <span className="text-base text-[#2c3036]">Enter the 6-digit code from your authenticator app.</span>
                </label>
              ) : mode === "join" ? (
                <label className="flex flex-col gap-1 text-base">
                  Your name
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    required
                    className="h-10 md:text-base"
                  />
                </label>
              ) : null}
              {totpChallenge ? null : (
              <>
              <label className="flex flex-col gap-1 text-base">
                Email
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  maxLength={254}
                  required
                  className="h-10 md:text-base"
                />
              </label>
              <PasswordField
                label="Password"
                value={password}
                onChange={setPassword}
                autoComplete={mode === "join" ? "new-password" : "current-password"}
                minLength={8}
                maxLength={200}
              />
              {mode === "join" ? (
                <div className="flex flex-col gap-1">
                  <PasswordField
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    minLength={8}
                    maxLength={200}
                  />
                  {confirmError ? (
                    <p className="text-base text-late" role="alert">
                      {confirmError}
                    </p>
                  ) : null}
                </div>
              ) : null}
              </>
              )}
              {error && error !== confirmError && !staleMismatch ? (
                <p className="text-base text-late" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={pending} className="mt-1 h-11 w-fit">
                {totpChallenge ? "Confirm code" : mode === "join" ? "Create an account" : "Sign in"}
              </Button>
              <button
                type="button"
                className="w-fit text-base text-[#2c3036] underline-offset-4 hover:underline"
                onClick={() => {
                  setMode(mode === "join" ? "sign-in" : "join");
                  setError(null);
                  setConfirmPassword("");
                }}
              >
                {mode === "join" ? "I already have an account" : "Create an account"}
              </button>
            </form>
            <p className="mt-6 max-w-md text-base leading-relaxed text-[#2c3036]">
              The account is kept on the server for this market. The desk you work stays in this browser.
            </p>
          </div>
      </div>
      <TeamSection />
      <section className="border-t">
        <div className="px-5 py-6 sm:px-10">
          <h2 className="text-xl font-semibold tracking-tight">Departments</h2>
        </div>
        <DepartmentGrid />
      </section>
      <section className="border-t">
        <div className="px-5 py-6 sm:px-10">
          <h2 className="text-xl font-semibold tracking-tight">Who ships</h2>
          <p className="mt-2 max-w-xl text-base leading-relaxed text-[#2c3036]">
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
                <p className="text-base font-medium text-white">{place.title}</p>
                <p className="max-w-md text-pretty text-base text-white">{place.line}</p>
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
        <ConnectPayout />
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
