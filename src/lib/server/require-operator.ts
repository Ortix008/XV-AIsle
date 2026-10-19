import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountFromToken } from "./accounts";
import { SESSION_COOKIE } from "./session-cookie";

/** Operator desk pages. Shoppers are sent home and never see the desk. */
export async function requireOperator() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const account = accountFromToken(token);
  if (account?.role !== "admin") redirect("/");
  return account;
}
