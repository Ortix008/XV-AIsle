"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/reveal";
import { ShopFooter } from "@/components/shop-footer";
import { StoreHeader } from "@/components/store-header";
import { DepartmentGrid } from "@/components/department-grid";
import { NightStalls } from "@/components/night-stalls";
import { AisleParallax, XvAisleFlow } from "@/components/xvaisle-flow";
import { ResellerWaitlist } from "@/components/reseller-waitlist";
import { ShopGrid } from "@/components/shop-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/password-field";
import { useAccount } from "@/lib/account-store";
import { welcomeReach } from "@/lib/art";
import { HERO_EYEBROW } from "@/lib/hero-copy";
import { RETURN_WINDOW_DAYS } from "@/lib/policies";

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

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#home-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <StoreHeader />
      <main id="home-main" className="page-enter">
        <section className="hero-aisle">
          <div className="hero-aisle-stage" aria-hidden>
            <AisleParallax>
              <Image
                src="/brand/hero-aisle-pedestals.webp"
                alt=""
                fill
                priority
                sizes="100vw"
                className="hero-aisle-photo"
              />
            </AisleParallax>
            <div className="hero-aisle-grade" />
            <XvAisleFlow />
            <div className="hero-aisle-scrim" />
          </div>
          <div className="relative z-[1] mx-auto flex min-h-[inherit] max-w-[1280px] flex-col justify-center px-5 py-16 sm:px-10 lg:py-24">
            <div className="hero-glow" aria-hidden />
            <div className="relative z-[1] max-w-xl">
              <p className="eyebrow hero-eyebrow">{HERO_EYEBROW}</p>
              <h1 className="mt-5 text-[3.25rem] leading-[0.95] font-bold tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
                <span className="hero-break">Goods that </span>earn their <span className="text-primary">place.</span>
              </h1>
              <p className="mt-7 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                A night market of home, kitchen, and everyday goods. Every product page tells you where it ships from,
                how long it takes, and, when we wrote one, why it earned its place.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/shop" className="pill pill-primary max-[899px]:flex-1">
                  Shop the aisles
                </Link>
                <Link href="/shop/reseller" className="pill pill-ghost max-[899px]:flex-1">
                  Reseller program coming soon.
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="aisles" className="scroll-mt-24">
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10 sm:py-[72px] lg:py-[110px]">
            <Reveal className="mb-10 flex items-end justify-between gap-5">
              <div>
                <p className="eyebrow">Aisles</p>
                <h2 className="mt-3 text-4xl sm:text-5xl lg:text-[52px]">Four aisles</h2>
                <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground">
                  {"Each one has its own glow. Here's what you'll find inside."}
                </p>
              </div>
              <Link href="/shop" className="link-slide shrink-0 text-sm text-muted-foreground hover:text-primary">
                View all →
              </Link>
            </Reveal>
            <NightStalls />
            <h3 className="mt-16 mb-8 text-3xl sm:text-4xl">More aisles to wander.</h3>
            <DepartmentGrid />
          </div>
        </section>

        <section className="border-y border-border bg-secondary">
          <ShopGrid
            kicker="Featured"
            title="In the store"
            lede="Pay safely with Stripe, and your order ships straight to your door."
            query=""
            empty="Nothing's on the shelves yet. We're picking the first pieces now."
            limit={4}
            seeAllHref="/shop"
            level="section"
          />
        </section>

        <section>
          <div className="mx-auto grid max-w-[1280px] gap-5 px-5 py-16 sm:px-10 sm:py-[72px] lg:grid-cols-3 lg:py-[110px]">
            <Reveal as="article" index={0} className="rounded-2xl border border-border bg-secondary p-7">
              <span className="mb-4 inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
              <h2 className="text-lg">Open product info</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Each product page tells you why we picked it and our best estimate for delivery.
              </p>
            </Reveal>
            <Reveal as="article" index={1} className="rounded-2xl border border-border bg-secondary p-7">
              <span className="mb-4 inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
              <h2 className="text-lg">{RETURN_WINDOW_DAYS}-day returns</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Changed your mind? Start a return within {RETURN_WINDOW_DAYS} days of delivery.
              </p>
            </Reveal>
            <Reveal as="article" index={2} className="rounded-2xl border border-border bg-secondary p-7">
              <span className="mb-4 inline-block size-2 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]" aria-hidden />
              <h2 className="text-lg">Secure checkout</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Stripe handles your payment. A real person answers your questions.
              </p>
            </Reveal>
          </div>
        </section>

        {mode === "join" ? (
          <section className="border-t border-border">
            <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10 lg:py-24">
              <Reveal>
              <h2 className="text-4xl sm:text-5xl">Two ways in</h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
                Share your shop link anywhere. Buyers pay on xvaisle.com. Payouts go through Stripe Connect, to a bank
                account you add there.
              </p>
              </Reveal>
              <div className="mt-10 grid gap-5 md:grid-cols-2">
                <Reveal as="article" index={0} className="rounded-2xl border border-border bg-card p-7">
                  <p className="font-heading text-sm text-primary">01</p>
                  <h3 className="mt-2 text-2xl">Sell</h3>
                  <div className="mt-4">
                    <ResellerWaitlist />
                  </div>
                </Reveal>
                <Reveal as="article" index={1} className="rounded-2xl border border-border bg-card p-7">
                  <p className="text-base leading-relaxed text-muted-foreground">
                    {"Every product earns its place. We pick from real companies and review each one before it's listed."}
                  </p>
                </Reveal>
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-border">
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10">
            <Reveal>
              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
                We take a close look at every product before it reaches our aisles.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="relative isolate min-h-[360px] overflow-hidden">
            <Image
              src="/brand/hero-warehouse-flow-green.webp"
              alt=""
              fill
              sizes="100vw"
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/82 via-black/55 to-black/30" />
            <Reveal className="relative z-10 flex min-h-[360px] flex-col justify-end px-5 py-12 sm:px-10">
              <h2 className="text-4xl text-white sm:text-5xl">Who ships</h2>
              <p className="mt-3 max-w-xl text-base leading-relaxed text-white/90">
                Your order is sent straight to your door.
              </p>
            </Reveal>
          </div>
          <ul className="mx-auto grid max-w-[1280px] gap-5 px-5 py-8 sm:px-10 md:grid-cols-2">
            {welcomeReach.map((place, index) => (
              <Reveal key={place.title} as="li" index={index} className="product-card overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-[16/10]">
                  <Image src={place.src} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="media-zoom object-cover" />
                </div>
                <div className="px-5 py-4">
                  <p className="font-heading text-lg">{place.title}</p>
                  <p className="mt-1 text-pretty text-sm text-muted-foreground">{place.line}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </section>

        <section id="account" className="scroll-mt-24 px-5 py-16 sm:px-10 lg:py-24">
          <Reveal className="mx-auto grid max-w-[1280px] gap-8 rounded-[18px] border border-border bg-card p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:p-10">
            <div>
              <h2 className="text-4xl sm:text-5xl">{mode === "join" ? "Open an account" : "Sign in"}</h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                {mode === "join"
                  ? "Welcome in. Let's set up your account."
                  : "Welcome back. Sign in to your account."}
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                <Link href="/shop/reseller/terms" className="text-[var(--link)] underline underline-offset-4 hover:text-foreground">
                  Reseller terms
                </Link>
              </p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
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
                  <span className="text-base text-muted-foreground">Enter the 6-digit code from your authenticator app.</span>
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
                    className="h-11 md:text-base"
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
                      className="h-11 md:text-base"
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
              <Button type="submit" disabled={pending} className="mt-1 h-12 w-fit rounded-full px-6">
                {totpChallenge ? "Confirm code" : mode === "join" ? "Create an account" : "Sign in"}
              </Button>
              {mode === "sign-in" && !totpChallenge ? (
                <Link href="/reset" className="w-fit text-base text-[var(--link)] underline underline-offset-4 hover:text-foreground">
                  Forgot password
                </Link>
              ) : null}
              <button
                type="button"
                className="w-fit text-base text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                onClick={() => {
                  setMode(mode === "join" ? "sign-in" : "join");
                  setError(null);
                  setConfirmPassword("");
                }}
              >
                {mode === "join" ? "I already have an account" : "Create an account"}
              </button>
            </form>
          </Reveal>
        </section>
      </main>
      <ShopFooter />
    </div>
  );
}
