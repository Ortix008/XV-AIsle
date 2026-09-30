import { hasActiveMembership, type AccountRole } from "../account";

export type Actor = {
  id: string;
  role: AccountRole;
  memberSince: number | null;
  membershipStatus: string | null;
};

export function settingsWriteDecision(account: Actor | null) {
  if (!account) return { status: 401 as const, error: "Sign in first." };
  if (account.role !== "admin") {
    return { status: 403 as const, error: "Only the operator can change the return address." };
  }
  return null;
}

export function inquiryReadDecision(account: Actor | null) {
  if (!account) return { status: 401 as const, error: "Sign in first." };
  if (account.role !== "admin") {
    return { status: 403 as const, error: "Only the operator can read buyer notes." };
  }
  return null;
}

export function publishDenial(account: Actor, connectReady: boolean) {
  if (account.role !== "reseller" && account.role !== "admin") {
    return "Only a reseller can publish a listing.";
  }
  if (!hasActiveMembership(account)) {
    return "An active membership is required before a listing can go on the store.";
  }
  if (!connectReady) {
    return "Finish Stripe payout setup before publishing.";
  }
  return null;
}

export function deliverDecision(account: Actor | null) {
  if (!account) return { status: 401 as const, error: "Sign in first." };
  if (account.role !== "admin") {
    return { status: 403 as const, error: "Only the operator can mark an order delivered." };
  }
  return null;
}
