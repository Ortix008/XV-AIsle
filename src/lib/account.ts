export const MEMBER_PRICE = 10;
export const TRIAL_DAYS = 30;
export const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;

export type PlanStatus = "trial" | "member" | "closed";

export type Account = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  memberSince: number | null;
};

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
