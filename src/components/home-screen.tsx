"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Reveal } from "@/components/reveal";
import { ShopFooter } from "@/components/shop-footer";
import { StoreHeader } from "@/components/store-header";
import { botIcon } from "@/components/bot-mark";
import { DepartmentGrid } from "@/components/department-grid";
import { NightStalls } from "@/components/night-stalls";
import { AisleParallax, XvAisleFlow } from "@/components/xvaisle-flow";
import { ShopGrid } from "@/components/shop-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordField } from "@/components/password-field";
import { useAccount } from "@/lib/account-store";
import { welcomeReach } from "@/lib/art";
import { bots } from "@/lib/bots";
import { HERO_EYEBROW } from "@/lib/hero-copy";
import { RETURN_WINDOW_DAYS, resellerCommissionLabel } from "@/lib/policies";

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
              <p className="eyebrow">{HERO_EYEBROW}</p>
              <h1 className="mt-5 text-[3.25rem] leading-[0.95] font-bold tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">
                Goods that
                <br />
                earn their <span className="text-primary">place.</span>
              </h1>
              <p className="mt-7 max-w-md text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
                A night market of home, kitchen, and everyday goods. Every product page tells you where it ships from,
                how long it takes, and, when we wrote one, why it earned its place.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/shop" className="pill pill-primary max-[899px]:flex-1">
                  Shop the aisles
                </Link>
                <a href="#account" className="pill pill-ghost max-[899px]:flex-1">
                  {mode === "join" ? "Open an account" : "Sign in"}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="aisles" className="scroll-mt-24">
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10 sm:py-[72px] lg:py-[110px]">
            <Reveal className="mb-10 flex items-end justify-between gap-5">
              <div>
                <p className="eyebrow">Aisles</p>
                <h2 className="mt-3 text-4xl sm:text-5xl lg:text-[52px]">Four stalls</h2>
                <p className="mt-4 max-w-xl text-pretty text-base text-muted-foreground">
                  Each stall has its own lamp. The line under the name is what that stall actually holds.
                </p>
              </div>
              <Link href="/shop" className="link-slide shrink-0 text-sm text-muted-foreground hover:text-primary">
                View all →
              </Link>
            </Reveal>
            <NightStalls />
            <h3 className="mt-16 mb-8 text-3xl sm:text-4xl">The rest of the floor</h3>
            <DepartmentGrid />
          </div>
        </section>

        <section className="border-y border-border bg-secondary">
          <ShopGrid
            kicker="Featured"
            title="In the store"
            lede="Payment goes to Stripe. After it clears, the supplier that holds the stock ships the order."
            query=""
            empty="Nothing is marked ready yet."
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
                Ships from, delivery time, and why we picked it, on every page that has those facts.
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
                Payments handled by Stripe. Questions answered by a real person.
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
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    You choose products the platform has already approved. You do not buy the stock.
                  </p>
                  <ol className="mt-5 list-decimal space-y-3 pl-5 text-base leading-relaxed">
                    <li>
                      Open an account. Joining is free. Commission is {resellerCommissionLabel()} of a completed sale.{" "}
                      <Link href="/shop/reseller/terms" className="underline underline-offset-4">
                        Read the reseller terms
                      </Link>
                      .
                    </li>
                    <li>Add an approved product to your shop and set a price inside the range the platform set.</li>
                    <li>Share your shop link anywhere. The supplier ships the order. Buyers pay on xvaisle.com.</li>
                  </ol>
                </Reveal>
                <Reveal as="article" index={1} className="rounded-2xl border border-border bg-card p-7">
                  <p className="font-heading text-sm text-primary">02</p>
                  <h3 className="mt-2 text-2xl">Supply</h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                    You already hold the goods. The platform decides what can be sold.
                  </p>
                  <ol className="mt-5 list-decimal space-y-3 pl-5 text-base leading-relaxed">
                    <li>Open an account and choose supplier.</li>
                    <li>Submit the product, the cost, the shipping, and a photo.</li>
                    <li>Wait for review. Only an approved product can appear in a reseller shop.</li>
                  </ol>
                </Reveal>
              </div>
            </div>
          </section>
        ) : null}

        <section className="border-t border-border">
          <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-10">
            <Reveal>
            <h2 className="text-4xl sm:text-5xl">SI Team</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
              These are AI tools, not people. Signal finds a product people already want and a supplier in the US. Draft
              writes the page, Harbor watches the order, and Cast drafts a post you can copy. You still say yes. Nothing
              is posted for you.
            </p>
            </Reveal>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2">
              {bots.map((member, index) => {
                const Icon = botIcon(member.id);
                return (
                  <Reveal key={member.id} as="li" index={index % 5} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center gap-3">
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-border bg-secondary">
                        <Icon aria-hidden className="size-6" />
                      </span>
                      <div>
                        <p className="font-heading text-lg">{member.name}</p>
                        <span className="mt-1 inline-flex rounded-full border border-border px-2.5 py-0.5 text-sm text-muted-foreground">
                          AI assistant
                        </span>
                      </div>
                    </div>
                    <p className="mt-4 text-base leading-relaxed">{member.does}</p>
                    <p className="mt-1 text-base leading-relaxed text-muted-foreground">{member.job}</p>
                  </Reveal>
                );
              })}
            </ul>
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
                A neighborhood shop or a national floor packs the order. You do not hold the box.
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
                  ? `Joining is free. Commission is ${resellerCommissionLabel()} of a completed sale. We do not promise income.`
                  : "Sign in to your account. The reseller program is free to join."}
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
