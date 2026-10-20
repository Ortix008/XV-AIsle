"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { AuthBackdrop } from "@/components/auth-backdrop";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/lib/account-store";

function AuthScreen({
  title,
  lede,
  children,
  wide = false,
  signup = false,
}: {
  title: string;
  lede: string;
  children: ReactNode;
  wide?: boolean;
  signup?: boolean;
}) {
  return (
    <div className={signup ? "auth-screen auth-screen-signup" : "auth-screen"}>
      <a href="#auth-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2">
        Skip to the form
      </a>
      <AuthBackdrop />
      <div className="auth-screen-body">
        <div className="auth-stack">
          <Link href="/" className="auth-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/xv-aisle-mark.svg" width={40} height={40} alt="XV-AIsle" className="auth-mark" />
          </Link>
          <main id="auth-main" className={wide ? "auth-glass auth-glass-wide" : "auth-glass"}>
            <p className="eyebrow">Account</p>
            <h1 className="auth-title">{title}</h1>
            <p className="auth-lede">{lede}</p>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

function useEnterDeskWhenSignedIn() {
  const router = useRouter();
  const { ready, account } = useAccount();
  useEffect(() => {
    if (ready && account) router.replace(account.needsEmail ? "/account" : "/");
  }, [ready, account, router]);
}

function XMark() {
  return (
    <svg className="auth-x-mark" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"
      />
    </svg>
  );
}

function ContinueWithX({ disabled = false }: { disabled?: boolean }) {
  if (disabled) {
    return (
      <button type="button" className="auth-x" disabled>
        <XMark />
        Continue with X
      </button>
    );
  }
  return (
    <a href="/api/auth/x/start" className="auth-x">
      <XMark />
      Continue with X
    </a>
  );
}

function AuthOr() {
  return (
    <p className="auth-or">
      <span>or</span>
    </p>
  );
}

export function SignInScreen({
  showX = false,
  xDisabled = false,
  xNotice = null,
}: {
  showX?: boolean;
  xDisabled?: boolean;
  xNotice?: "code" | "failed" | null;
}) {
  const { signIn, totpChallenge, submitTotp, refresh } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(
    xNotice === "failed" ? "X sign-in did not finish. Use email, or try Continue with X again." : null,
  );
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const emailId = useId();
  const codeId = useId();
  const xCode = xNotice === "code" && !totpChallenge;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    if (xCode) {
      const response = await fetch("/api/auth/x/totp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        const message = data?.error ?? "That code did not match.";
        setError(message.includes("password") ? "That sign-in step expired. Use Continue with X again." : message);
        setPending(false);
        return;
      }
      await refresh();
      router.replace("/account");
      return;
    }
    const message = totpChallenge ? await submitTotp(code) : await signIn({ email, password });
    if (message) {
      setError(message);
      setPending(false);
      return;
    }
    const session = await fetch("/api/account");
    const body = (await session.json().catch(() => null)) as { account?: unknown } | null;
    if (body?.account) {
      router.replace("/account");
      return;
    }
    setPending(false);
  }

  return (
    <AuthScreen title="Sign in" lede="Welcome back. Sign in to your account.">
      <form onSubmit={onSubmit} className="auth-form">
        {totpChallenge || xCode ? (
          <label className="auth-field" htmlFor={codeId}>
            Authenticator code
            <Input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
              className="h-11 md:text-base"
            />
            <span className="auth-hint">Enter the 6-digit code from your authenticator app.</span>
          </label>
        ) : (
          <>
            {showX ? (
              <>
                <ContinueWithX disabled={xDisabled} />
                <AuthOr />
              </>
            ) : null}
            <label className="auth-field" htmlFor={emailId}>
              Email
              <Input
                id={emailId}
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
              autoComplete="current-password"
              minLength={8}
              maxLength={200}
            />
          </>
        )}
        {error ? (
          <p className="text-base text-late" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="auth-submit mt-1 h-12 w-full rounded-full px-6">
          {totpChallenge || xCode ? "Confirm code" : pending ? "Signing in…" : "Sign in"}
        </Button>
        {totpChallenge || xCode ? null : (
          <Link href="/reset" className="auth-text-link w-fit">
            Forgot password
          </Link>
        )}
        <Link href="/sign-up" className="auth-text-link w-fit">
          Create an account
        </Link>
      </form>
    </AuthScreen>
  );
}

export function SignUpScreen({ showX = false, xDisabled = false }: { showX?: boolean; xDisabled?: boolean }) {
  const { signUp } = useAccount();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const nameId = useId();
  const emailId = useId();
  useEnterDeskWhenSignedIn();

  const mismatchMessage = "Those passwords do not match.";
  const confirmError =
    password !== confirmPassword && (confirmPassword.length > 0 || error === mismatchMessage) ? mismatchMessage : null;
  const staleMismatch = error === mismatchMessage && password === confirmPassword;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(mismatchMessage);
      return;
    }
    setPending(true);
    const message = await signUp({ name, email, password, confirmPassword });
    setError(message);
    setPending(false);
  }

  return (
    <AuthScreen wide signup title="Open an account" lede="Welcome in. Let's set up your account.">
      <form onSubmit={onSubmit} className="auth-form auth-form-signup">
        {showX ? (
          <>
            <ContinueWithX disabled={xDisabled} />
            <AuthOr />
          </>
        ) : null}
        <label className="auth-field" htmlFor={nameId}>
          Your name
          <Input
            id={nameId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            maxLength={80}
            required
            className="h-11 md:text-base"
          />
        </label>
        <label className="auth-field" htmlFor={emailId}>
          Email
          <Input
            id={emailId}
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
          autoComplete="new-password"
          minLength={8}
          maxLength={200}
        />
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
        {error && error !== confirmError && !staleMismatch ? (
          <p className="text-base text-late" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={pending} className="auth-submit mt-1 h-12 w-full rounded-full px-6">
          {pending ? "Creating the account…" : "Create an account"}
        </Button>
        <div className="auth-signup-links">
          <Link href="/shop/reseller/terms" className="auth-text-link">
            Reseller terms
          </Link>
          <Link href="/sign-in" className="auth-text-link">
            I already have an account
          </Link>
        </div>
      </form>
    </AuthScreen>
  );
}

export function ResetRequestScreen() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/account/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "The reset email did not send. Try again.");
      return;
    }
    setMessage(data?.message ?? "If that email has an account, we'll email you a reset link.");
  }

  return (
    <AuthScreen
      title="Password help"
      lede="Forgot your password? We'll email you a reset link. Still stuck? Reach out from our Contact page. We reply within 2 business days."
    >
      <form onSubmit={onSubmit} className="auth-form">
        <label className="auth-field" htmlFor={emailId}>
          Email
          <Input
            id={emailId}
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            maxLength={254}
            required
            className="h-11 md:text-base"
          />
        </label>
        {error ? (
          <p className="text-base text-late" role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-base leading-relaxed">{message}</p> : null}
        <Button type="submit" disabled={pending} className="mt-1 h-12 w-full rounded-full px-6">
          {pending ? "Sending the link…" : "Email me a reset link"}
        </Button>
        <Link href="/shop/contact" className="auth-text-link w-fit">
          Contact the shop
        </Link>
        <Link href="/sign-in" className="auth-text-link w-fit">
          Back to sign in
        </Link>
      </form>
    </AuthScreen>
  );
}

export function ResetConfirmScreen({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/account/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setPending(false);
    if (!response.ok) {
      setError(data?.error ?? "That link is not valid.");
      return;
    }
    setDone(true);
  }

  return (
    <AuthScreen title="Reset" lede="Choose a new password. This link works once.">
      {done ? (
        <div className="auth-form">
          <p className="text-base leading-relaxed">Your password is updated. Sign in with the new one.</p>
          <Link href="/sign-in" className="pill pill-primary">
            Sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="auth-form">
          <PasswordField
            label="New password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
            maxLength={200}
          />
          {error ? (
            <p className="text-base text-late" role="alert">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending || token.length < 32} className="mt-1 h-12 w-full rounded-full px-6">
            {pending ? "Saving…" : "Save the new password"}
          </Button>
          <Link href="/reset" className="auth-text-link w-fit">
            Email me a new link
          </Link>
        </form>
      )}
    </AuthScreen>
  );
}
