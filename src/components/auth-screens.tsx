"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { AuthBackdrop } from "@/components/auth-backdrop";
import { BrandMark } from "@/components/brand-mark";
import { PasswordField } from "@/components/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAccount } from "@/lib/account-store";
import { REPLY_WITHIN_HOURS } from "@/lib/honest-price";
import { RESELLER_DISCLOSURE, resellerCommissionLabel, resellerPayLine } from "@/lib/policies";

function AuthScreen({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-screen">
      <a href="#auth-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-background focus:px-3 focus:py-2">
        Skip to the form
      </a>
      <AuthBackdrop />
      <div className="auth-screen-body">
        <div className="auth-stack">
          <Link href="/" className="auth-brand">
            <BrandMark />
          </Link>
          <main id="auth-main" className="auth-glass">
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
    if (ready && account) router.replace("/");
  }, [ready, account, router]);
}

export function SignInScreen() {
  const { signIn, totpChallenge, submitTotp } = useAccount();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const emailId = useId();
  const codeId = useId();
  useEnterDeskWhenSignedIn();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    const message = totpChallenge ? await submitTotp(code) : await signIn({ email, password });
    setError(message);
    setPending(false);
  }

  return (
    <AuthScreen title="Sign in" lede="Sign in to your account. The reseller program is free to join.">
      <form onSubmit={onSubmit} className="auth-form">
        {totpChallenge ? (
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
        <Button type="submit" disabled={pending} className="mt-1 h-12 w-full rounded-full px-6">
          {totpChallenge ? "Confirm code" : pending ? "Signing in…" : "Sign in"}
        </Button>
        {totpChallenge ? null : (
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

export function SignUpScreen() {
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
    <AuthScreen
      title="Open an account"
      lede={`Joining is free. Commission is ${resellerCommissionLabel()} of a completed sale. ${resellerPayLine()} If you mention a product, say ${RESELLER_DISCLOSURE}`}
    >
      <form onSubmit={onSubmit} className="auth-form">
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
        <Button type="submit" disabled={pending} className="mt-1 h-12 w-full rounded-full px-6">
          {pending ? "Creating the account…" : "Create an account"}
        </Button>
        <p className="text-base text-muted-foreground">
          <Link href="/shop/reseller/terms" className="auth-text-link">
            Reseller terms
          </Link>
        </p>
        <Link href="/sign-in" className="auth-text-link w-fit">
          I already have an account
        </Link>
      </form>
    </AuthScreen>
  );
}

export function ResetRequestScreen() {
  return (
    <AuthScreen
      title="Password help"
      lede={`This shop does not email a reset link, and this page does not change a password. Write from Contact and a person replies within ${REPLY_WITHIN_HOURS} hours.`}
    >
      <div className="auth-form">
        <p className="text-base leading-relaxed text-muted-foreground">
          Include the email on the account so the person who replies knows which door to open.
        </p>
        <Link href="/shop/contact" className="pill pill-primary">
          Contact the shop
        </Link>
        <Link href="/sign-in" className="auth-text-link w-fit">
          Back to sign in
        </Link>
      </div>
    </AuthScreen>
  );
}

export function ResetConfirmScreen() {
  return (
    <AuthScreen
      title="Reset"
      lede={`This page does not set a new password. There is no link to finish here. Write from Contact and a person replies within ${REPLY_WITHIN_HOURS} hours.`}
    >
      <div className="auth-form">
        <Link href="/shop/contact" className="pill pill-primary">
          Contact the shop
        </Link>
        <Link href="/reset" className="auth-text-link w-fit">
          Password help
        </Link>
        <Link href="/sign-in" className="auth-text-link w-fit">
          Back to sign in
        </Link>
      </div>
    </AuthScreen>
  );
}
