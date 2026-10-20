import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountView } from "@/components/account-view";
import { accountFromToken } from "@/lib/server/accounts";
import { entryRedirect } from "@/lib/server/entry-gate";
import { SESSION_COOKIE } from "@/lib/server/session-cookie";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const dest = entryRedirect("/account", accountFromToken(token));
  if (dest) redirect(dest);
  return <AccountView />;
}
