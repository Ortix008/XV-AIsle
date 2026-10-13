export type AccountRole = "admin" | "reseller" | "supplier" | "buyer";

export type Account = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  memberSince: number | null;
  role: AccountRole;
  membershipStatus: string | null;
  emailVerified: boolean;
  totpEnabled?: boolean;
};

/** Support reference. The full id stays on operator screens. */
export function accountSupportRef(id: string) {
  return `Ref …${id.slice(-6)}`;
}

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

/**
 * Records an existing Stripe subscription. A blank status is treated as active for rows
 * saved before statuses existed. Publishing does not call this.
 */
export function hasActiveMembership(account: { memberSince: number | null; membershipStatus?: string | null }) {
  if (!account.memberSince) return false;
  if (
    account.membershipStatus &&
    account.membershipStatus !== "active" &&
    account.membershipStatus !== "trialing"
  ) {
    return false;
  }
  return true;
}
