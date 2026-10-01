"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account-store";
import { useDesk } from "@/lib/desk-store";

export function GettingStarted() {
  const { account, connect, refresh } = useAccount();
  const { state, hideGettingStarted } = useDesk();
  const [inboxNote, setInboxNote] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const emailDone = account?.emailVerified === true;
  const authenticatorDone = account?.totpEnabled === true;
  const payoutsDone = connect?.transfersStatus === "active";
  const doneCount = Number(emailDone) + Number(authenticatorDone) + Number(payoutsDone);

  if (!account || state.gettingStartedHidden || doneCount === 3) return null;

  async function sendVerification() {
    setPending(true);
    setVerifyError(null);
    setInboxNote(null);
    try {
      const response = await fetch("/api/account/verify", { method: "POST" });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        setVerifyError(data?.error ?? "Mail is not configured.");
        return;
      }
      setInboxNote("Check your inbox");
      await refresh();
    } catch {
      setVerifyError("Mail is not configured.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 className="text-sm font-medium">Getting started</h2>
        <p className="text-xs text-muted-foreground">{doneCount} of 3 done</p>
        <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => hideGettingStarted()}>
          Hide
        </Button>
      </div>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        <li className="flex flex-wrap items-center gap-2">
          <span>Verify your email</span>
          {emailDone ? (
            <span className="text-xs text-muted-foreground">Done</span>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void sendVerification()}>
              {pending ? "Sending…" : "Send email"}
            </Button>
          )}
          {inboxNote ? <span>{inboxNote}</span> : null}
          {verifyError ? <span className="text-late">{verifyError}</span> : null}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <Link href="/membership#authenticator" className="underline underline-offset-4">
            Turn on an authenticator (2FA)
          </Link>
          {authenticatorDone ? <span className="text-xs text-muted-foreground">Done</span> : null}
        </li>
        <li className="flex flex-wrap items-center gap-2">
          <Link href="/membership#payouts" className="underline underline-offset-4">
            Connect Stripe payouts
          </Link>
          {payoutsDone ? <span className="text-xs text-muted-foreground">Done</span> : null}
        </li>
        <li>
          <Link href="/shop" className="underline underline-offset-4">
            Browse the store
          </Link>
        </li>
      </ul>
    </section>
  );
}
