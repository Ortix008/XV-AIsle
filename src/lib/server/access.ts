import { hasActiveMembership, type AccountRole } from "../account";

export type Actor = {
  id: string;
  role: AccountRole;
  memberSince: number | null;
  membershipStatus: string | null;
  emailVerified: boolean;
  totpEnabled: boolean;
};

export function verifiedAdmin(account: Actor | null) {
  if (!account) return { status: 401 as const, error: "Sign in first." };
  if (account.role !== "admin" || !account.emailVerified) {
    return { status: 403 as const, error: "Only a verified operator can do that." };
  }
  return null;
}

/** Admin actions that approve a product or release a payout. */
export function adminWithTotp(account: Actor | null) {
  const admin = verifiedAdmin(account);
  if (admin) return admin;
  if (!account?.totpEnabled) {
    return {
      status: 403 as const,
      error: "Turn on an authenticator app before you approve a product or release a payout.",
    };
  }
  return null;
}

export function settingsWriteDecision(account: Actor | null) {
  const admin = verifiedAdmin(account);
  if (admin) return admin;
  return null;
}

export function inquiryReadDecision(account: Actor | null) {
  const admin = verifiedAdmin(account);
  if (admin) return admin;
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
  const admin = verifiedAdmin(account);
  if (admin) return admin;
  return null;
}
