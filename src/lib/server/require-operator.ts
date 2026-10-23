import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountFromToken } from "./accounts";
import { SESSION_COOKIE } from "./session-cookie";

/** Operator desk pages. Shoppers and unverified admins are sent home. */
export async function requireOperator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (!account || account.role !== "admin" || !account.emailVerified) redirect("/");
  return account;
}
