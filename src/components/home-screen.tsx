"use client";

import Image from "next/image";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { botIcon } from "@/components/bot-mark";
import { DepartmentGrid } from "@/components/department-grid";
import { HomeScene } from "@/components/home-scene";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/password-field";
import { MEMBER_PRICE, TRIAL_DAYS } from "@/lib/account";
import { useAccount } from "@/lib/account-store";
import { welcomeReach } from "@/lib/art";
import { bots } from "@/lib/bots";

type HomeTheme = "dark" | "light";

const pulse = [
  { who: "Signal", text: "Filed a quarter sheet pan. It is already in a US warehouse." },
  { who: "Draft", text: "Wrote the canvas apron page. It is waiting to be read." },
  { who: "Harbor", text: "An order is late. The reply is sitting here for a yes." },
  { who: "Cast", text: "Wrote a post you can copy. Nothing has been published." },
];

function nextTheme(theme: HomeTheme): HomeTheme {
  switch (theme) {
    case "dark":
      return "light";
    case "light":
      return "dark";
    default: {
      const neverTheme: never = theme;
      return neverTheme;
    }
  }
}

function ThemeToggle() {
  function apply() {
    const current = document.documentElement.dataset.theme === "light" ? "light" : "dark";
    const next = nextTheme(current);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem("xvaisle-theme", next);
  }

  return (
    <button
      type="button"
      className="grid size-9 place-items-center rounded-full border border-current/20 hover:bg-white/10"
      aria-label="Switch color theme"
      onClick={apply}
    >
      <Sun aria-hidden className="size-4 home-icon-sun" />
      <Moon aria-hidden className="size-4 home-icon-moon" />
    </button>
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
    <div className="home min-h-dvh">
      <header className="home-header sticky top-0 z-20 flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="min-w-0">
          <BrandMark />
        </Link>
        <nav className="flex items-center gap-3 text-sm sm:gap-5">
          <Link href="/shop" className="hover:opacity-80">
            Store
          </Link>
          <Link href="/shop/safety" className="hidden hover:opacity-80 md:inline">
            How buying works
          </Link>
          <ThemeToggle />
          <a href="#account" className="rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
            Account
          </a>
        </nav>
      </header>

      <section className="relative isolate min-h-[calc(100dvh-3.5rem)] overflow-hidden">
        <Image
          src="/brand/hero-aisle-pedestals.webp"
          alt=""
          fill
          preload
          sizes="100vw"
          className="object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/78 to-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/50" />
        <HomeScene />
        <div className="relative z-10 flex min-h-[calc(100dvh-3.5rem)] flex-col justify-end px-5 py-14 text-white sm:px-10 lg:px-14 lg:py-20">
          <p className="text-xs font-semibold tracking-[0.22em] text-[#b6ff6a] uppercase">A US trend market</p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl leading-[0.95] font-semibold tracking-tight sm:text-6xl">
            {mode === "join" ? "Sell approved products without holding the box." : "Welcome back."}
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-white/90 sm:text-lg">
            Companies list extra inventory. You resell it. A neighborhood shop or a national floor ships the order.
            Buyers pay on xvaisle.com.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#account" className="rounded-full bg-[#3dff8a] px-5 py-3 text-sm font-semibold text-[#052112]">
              {mode === "join" ? "Create an account" : "Sign in"}
            </a>
            <Link
              href="/shop"
              className="rounded-full border border-white/40 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
            >
              Browse the store
            </Link>
          </div>
          <ul className="mt-10 grid gap-3 text-sm text-white/90 sm:grid-cols-3">
            <li className="border-t border-white/25 pt-3">
              {TRIAL_DAYS} days free, then ${MEMBER_PRICE}/month
            </li>
            <li className="border-t border-white/25 pt-3">Buyers pay on xvaisle.com</li>
            <li className="border-t border-white/25 pt-3">Payouts through Stripe Connect</li>
          </ul>
        </div>
      </section>

      <div className="flex items-center gap-3 border-y border-[var(--border)] px-5 py-3 sm:px-10">
        <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
        <p className="truncate text-sm text-[var(--ink-soft)]">
          <span className="font-medium text-foreground">{line.who}</span>
          <span> · AI assistant · </span>
          {line.text}
        </p>
      </div>

      {mode === "join" ? (
        <section className="reveal px-5 py-16 sm:px-10 lg:px-14">
          <h2 className="text-3xl font-semibold tracking-tight">Two ways in</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--ink-soft)]">
            Share your shop link anywhere. Buyers pay on xvaisle.com. Payouts go through Stripe Connect, to a bank
            account you add there.
          </p>
          <div className="mt-10 grid gap-10 md:grid-cols-2">
            <div>
              <p className="font-mono text-sm text-primary">01</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Sell</h3>
              <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">
                You choose products the platform has already approved. You do not buy the stock.
              </p>
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-base leading-relaxed">
                <li>
                  Open an account. The first {TRIAL_DAYS} days are free. After that, membership is ${MEMBER_PRICE} a
                  month.
                </li>
                <li>Add an approved product to your shop and set a price inside the range the platform set.</li>
                <li>Share your shop link anywhere. The supplier ships the order. Buyers pay on xvaisle.com.</li>
              </ol>
            </div>
            <div>
              <p className="font-mono text-sm text-primary">02</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Supply</h3>
              <p className="mt-3 text-base leading-relaxed text-[var(--ink-soft)]">
                You already hold the goods. The platform decides what can be sold.
              </p>
              <ol className="mt-5 list-decimal space-y-3 pl-5 text-base leading-relaxed">
                <li>Open an account and choose supplier.</li>
                <li>Submit the product, the cost, the shipping, and a photo.</li>
                <li>Wait for review. Only an approved product can appear in a reseller shop.</li>
              </ol>
            </div>
          </div>
        </section>
      ) : null}

      <section className="reveal border-t border-[var(--border)]">
        <div className="px-5 py-12 sm:px-10 lg:px-14">
          <h2 className="text-3xl font-semibold tracking-tight">SI Team</h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-[var(--ink-soft)]">
            These are AI tools, not people. Signal finds a product people already want and a supplier in the US. Draft
            writes the page, Harbor watches the order, and Cast drafts a post you can copy. You still say yes. Nothing
            is posted for you.
          </p>
        </div>
        <ul className="grid border-t border-[var(--border)] sm:grid-cols-2">
          {bots.map((member) => {
            const Icon = botIcon(member.id);
            return (
              <li key={member.id} className="border-b border-[var(--border)] px-5 py-6 sm:px-8 lg:px-14">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <Icon aria-hidden className="size-6" />
                  </span>
                  <div>
                    <p className="text-lg font-medium">{member.name}</p>
                    <span className="mt-1 inline-flex rounded-full border border-foreground/30 px-2.5 py-0.5 text-sm">
                      AI assistant
                    </span>
                  </div>
                </div>
                <p className="mt-4 text-base leading-relaxed">{member.does}</p>
                <p className="mt-1 text-base leading-relaxed text-[var(--ink-soft)]">{member.job}</p>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="reveal">
        <div className="px-5 py-10 sm:px-10 lg:px-14">
          <h2 className="text-3xl font-semibold tracking-tight">Departments</h2>
          <p className="mt-3 max-w-xl text-base text-[var(--ink-soft)]">
            What the market can list. Not fresh food, and not medicine.
          </p>
        </div>
        <DepartmentGrid />
      </section>

      <section className="reveal border-t border-[var(--border)]">
        <div className="relative isolate min-h-[360px] overflow-hidden">
          <Image
            src="/brand/hero-warehouse-flow-green.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/55 to-black/30" />
          <div className="relative z-10 flex min-h-[360px] flex-col justify-end px-5 py-12 text-white sm:px-10 lg:px-14">
            <h2 className="text-3xl font-semibold tracking-tight">Who ships</h2>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90">
              A neighborhood shop or a national floor packs the order. You do not hold the box.
            </p>
          </div>
        </div>
        <ul className="grid gap-px bg-[var(--border)] md:grid-cols-2">
          {welcomeReach.map((place) => (
            <li key={place.title} className="relative aspect-[16/10] bg-[var(--card)]">
              <Image src={place.src} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-black/75 px-4 py-3 sm:px-5">
                <p className="text-base font-medium text-white">{place.title}</p>
                <p className="max-w-md text-pretty text-base text-white">{place.line}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="account" className="reveal scroll-mt-16 px-5 py-16 sm:px-10 lg:px-14">
        <div className="home-panel grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:p-10">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {mode === "join" ? "Open an account" : "Sign in"}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--ink-soft)]">
              {mode === "join"
                ? `The first ${TRIAL_DAYS} days are free. After that, membership is $${MEMBER_PRICE} a month. If you stop, the account stays and the market closes.`
                : `Sign in and the market opens again. The first ${TRIAL_DAYS} days are free. After that, membership is $${MEMBER_PRICE} a month.`}
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--ink-soft)]">
              Your account is kept on the server. Payouts are Stripe Connect only.
            </p>
          </div>
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
                <span className="text-base text-[var(--ink-soft)]">Enter the 6-digit code from your authenticator app.</span>
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
              className="w-fit text-base text-[var(--ink-soft)] underline-offset-4 hover:underline"
              onClick={() => {
                setMode(mode === "join" ? "sign-in" : "join");
                setError(null);
                setConfirmPassword("");
              }}
            >
              {mode === "join" ? "I already have an account" : "Create an account"}
            </button>
          </form>
        </div>
      </section>

      <footer className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border)] px-5 py-8 text-sm text-[var(--ink-soft)] sm:px-10">
        <span className="text-foreground">XV-AIsle</span>
        <Link href="/shop" className="hover:text-foreground">
          Store
        </Link>
        <Link href="/shop/safety" className="hover:text-foreground">
          How buying works
        </Link>
        <Link href="/shop/privacy" className="hover:text-foreground">
          Privacy
        </Link>
      </footer>
    </div>
  );
}
