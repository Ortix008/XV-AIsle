export const MEMBER_PRICE = 10;
export const TRIAL_DAYS = 30;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export type PlanStatus = "trial" | "member" | "closed";

export type AccountRole = "admin" | "reseller" | "supplier" | "buyer";

export type Account = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  memberSince: number | null;
  role: AccountRole;
  membershipStatus: string | null;
};

export function isAccountRole(value: string | null | undefined): value is AccountRole {
  switch (value) {
    case "admin":
    case "reseller":
    case "supplier":
    case "buyer":
      return true;
    default:
      return false;
  }
}

/** Paid membership. A blank status is treated as active for rows saved before statuses existed. */
export function hasActiveMembership(account: { memberSince: number | null; membershipStatus?: string | null }) {
  if (!account.memberSince) return false;
  if (account.membershipStatus && account.membershipStatus !== "active") return false;
  return true;
}

export function planStatus(
  account: Pick<Account, "createdAt" | "memberSince">,
  now = Date.now(),
): PlanStatus {
  if (account.memberSince) return "member";
  if (now < account.createdAt + TRIAL_MS) return "trial";
  return "closed";
}

export function trialDaysLeft(
  account: Pick<Account, "createdAt" | "memberSince">,
  now = Date.now(),
) {
  if (account.memberSince) return 0;
  const left = account.createdAt + TRIAL_MS - now;
  if (left <= 0) return 0;
  return Math.ceil(left / (24 * 60 * 60 * 1000));
}

export function canKeepBotsRunning(status: PlanStatus) {
  return status === "member";
}
