import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isOperatorAccount } from "../account";
import { accountFromToken } from "./accounts";
import { SESSION_COOKIE } from "./session-cookie";

export { isOperatorAccount };

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
