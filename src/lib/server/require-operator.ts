import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountFromToken } from "./accounts";
import { SESSION_COOKIE } from "./session-cookie";

export function isOperatorAccount<T extends { role: string; emailVerified: boolean }>(
  account: T | null | undefined,
): account is T {
  return Boolean(account && account.role === "admin" && account.emailVerified);
}

export async function viewerIsOperator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return isOperatorAccount(accountFromToken(token));
}

/** Operator desk pages. Shoppers and unverified admins are sent home. */
export async function requireOperator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!isOperatorAccount(account)) redirect("/");
  return account;
}
