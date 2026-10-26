import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), "xvaisle-entry-")), "entry.sqlite");

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

function sliceBetween(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error(`missing ${start}`);
  return source.slice(from, to);
}

async function main() {
  const { entryRedirect } = await import("../src/lib/server/entry-gate");
  const { accountFromToken, signUp } = await import("../src/lib/server/accounts");

  assert(entryRedirect("/sign-in", null) === null, "a signed-out visitor stays on sign-in");
  assert(entryRedirect("/account", null) === "/sign-in", "a signed-out visitor leaves account for sign-in");
  assert(entryRedirect("/sign-in", { id: "member" }) === "/account", "a signed-in visitor leaves sign-in for account");
  assert(entryRedirect("/account", { id: "member" }) === null, "a signed-in visitor stays on account");

  const created = signUp({ name: "Entry Buyer", email: "entry-buyer@example.com", password: "long-password" });
  if ("error" in created) throw new Error(created.error);
  const account = accountFromToken(created.token);
  assert(account?.id === created.account.id, "the session resolves to the account");
  assert(entryRedirect("/sign-in", account) === "/account", "a real session on sign-in goes to account");
  assert(entryRedirect("/account", account) === null, "a real session stays on account");
  assert(entryRedirect("/sign-in", accountFromToken(undefined)) === null, "no cookie stays on sign-in");
  assert(entryRedirect("/account", accountFromToken("not-a-session")) === "/sign-in", "a bad cookie is signed out");

  const screen = readFileSync(new URL("../src/components/auth-screens.tsx", import.meta.url), "utf8");
  const signIn = sliceBetween(screen, "export function SignInScreen", "export function SignUpScreen");
  assert(!signIn.includes("useEnterDeskWhenSignedIn"), "sign-in does not use the client redirect that jumps home");
  assert(!signIn.includes('router.replace("/")') && !signIn.includes("router.replace('/')"), "sign-in does not replace the route with home");
  assert(signIn.includes('router.replace("/account")'), "a finished sign-in continues to account");

  const signInPage = readFileSync(new URL("../src/app/(entry)/sign-in/page.tsx", import.meta.url), "utf8");
  assert(signInPage.includes('entryRedirect("/sign-in"'), "sign-in asks the server gate");
  assert(signInPage.includes("redirect(dest)"), "sign-in redirects on the server");

  const accountPage = readFileSync(new URL("../src/app/(desk)/account/page.tsx", import.meta.url), "utf8");
  assert(accountPage.includes('entryRedirect("/account"'), "account asks the server gate");
  assert(accountPage.includes("redirect(dest)"), "account redirects on the server");

  const proxySource = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert(proxySource.includes("entryRedirect"), "the proxy redirects before the page renders");
  assert(proxySource.includes("NextResponse.redirect"), "sign-in and account use an HTTP redirect");

  const { ACCOUNT_CACHE_CONTROL, SIGNED_OUT_PATH, accountRestoreNeedsReload } = await import("../src/lib/account-cache");
  assert(SIGNED_OUT_PATH === "/", "sign out goes home");
  assert(ACCOUNT_CACHE_CONTROL.includes("no-store"), "account responses are not stored");
  assert(accountRestoreNeedsReload("/account", true), "back to a cached account page reloads");
  assert(!accountRestoreNeedsReload("/account", false), "a normal account visit does not reload");
  assert(!accountRestoreNeedsReload("/sign-in", true), "a restored sign-in page stays");
  assert(!accountRestoreNeedsReload("/shop", true), "a restored shop page stays");

  const store = readFileSync(new URL("../src/lib/account-store.tsx", import.meta.url), "utf8");
  const signOut = sliceBetween(store, "signOut: () => {", "chooseRole:");
  assert(signOut.includes('fetch("/api/account/signout"'), "sign out ends the session on the server first");
  assert(signOut.includes("setAccount(null)"), "sign out clears the signed-in account on screen");
  assert(signOut.includes("return false"), "a failed sign out leaves the screen alone");
  assert(signOut.includes("return true"), "a finished sign out tells the page to leave");
  const fetchAt = signOut.indexOf('fetch("/api/account/signout"');
  const clearAt = signOut.indexOf("setAccount(null)");
  assert(fetchAt < clearAt, "sign out clears the session before it drops the account on screen");
  assert(
    store.includes("accountRestoreNeedsReload(window.location.pathname, event.persisted)") &&
      store.includes("window.location.reload()"),
    "a restored account page reloads instead of showing the cached sign-in",
  );
  assert(store.includes('fetch("/api/account", { cache: "no-store" })'), "the account request is not reused from cache");
  const shell = readFileSync(new URL("../src/components/desk-shell.tsx", import.meta.url), "utf8");
  const leave = sliceBetween(shell, "function SignOutButton", "export function DeskShell");
  assert(leave.includes("Sign out"), "the sign-out control is unchanged");
  assert(leave.includes("router.replace(SIGNED_OUT_PATH)"), "sign out replaces the account page");
  assert(leave.includes("router.refresh()"), "sign out refreshes server components");
  const endedAt = leave.indexOf("if (!ended) return");
  const replaceAt = leave.indexOf("router.replace(SIGNED_OUT_PATH)");
  const refreshAt = leave.indexOf("router.refresh()");
  assert(
    endedAt >= 0 && endedAt < replaceAt && replaceAt < refreshAt,
    "sign out leaves for home and refreshes only after the session ends",
  );
  assert(shell.includes("Signed in as {account.name}."), "the signed-in line is unchanged");
  assert(shell.includes("signed-in-line") && shell.includes("md:hidden"), "the signed-in line shows on a narrow screen");

  const { NextRequest } = await import("next/server");
  const { proxy } = await import("../src/proxy");
  const { SESSION_COOKIE } = await import("../src/lib/server/session-cookie");
  const { GET: accountGet } = await import("../src/app/api/account/route");
  const { POST: signOutPost } = await import("../src/app/api/account/signout/route");

  function accountRequest(token?: string) {
    return new NextRequest("https://xvaisle.com/account", token ? { headers: { cookie: `${SESSION_COOKIE}=${token}` } } : undefined);
  }

  const signedInPage = proxy(accountRequest(created.token));
  assert(signedInPage.status === 200 && signedInPage.headers.get("location") == null, "a signed-in account page stays");
  assert(
    signedInPage.headers.get("cache-control") === ACCOUNT_CACHE_CONTROL,
    "a signed-in account page is not stored",
  );

  const signedInApi = await accountGet(
    new Request("http://127.0.0.1/api/account", { headers: { cookie: `${SESSION_COOKIE}=${created.token}` } }),
  );
  const signedInBody = (await signedInApi.json()) as { account: { id: string } | null };
  assert(signedInApi.status === 200 && signedInBody.account?.id === created.account.id, "the account API shows who is signed in");
  assert(signedInApi.headers.get("cache-control") === ACCOUNT_CACHE_CONTROL, "the account API is not stored");

  const signedOut = await signOutPost(
    new Request("http://127.0.0.1/api/account/signout", {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE}=${created.token}` },
    }),
  );
  const clearing = signedOut.headers.get("set-cookie") ?? "";
  assert(signedOut.status === 200, "sign out answers");
  assert(clearing.includes(`${SESSION_COOKIE}=`), "sign out clears the session cookie");
  assert(clearing.toLowerCase().includes("max-age=0"), "the cleared session cookie expires immediately");
  assert(accountFromToken(created.token) == null, "sign out ends the session");

  const afterApi = await accountGet(
    new Request("http://127.0.0.1/api/account", { headers: { cookie: `${SESSION_COOKIE}=${created.token}` } }),
  );
  const afterBody = (await afterApi.json()) as { account: { id: string } | null };
  assert(afterBody.account == null, "the account API shows signed out after sign out");

  const backToAccount = proxy(accountRequest(created.token));
  const backLocation = backToAccount.headers.get("location");
  assert(backToAccount.status === 307 || backToAccount.status === 303, "back to account after sign out redirects");
  assert(backLocation != null && new URL(backLocation).pathname === "/sign-in", "back to account after sign out goes to sign-in");
  assert(backToAccount.headers.get("cache-control") === ACCOUNT_CACHE_CONTROL, "the signed-out account redirect is not stored");

  const signedOutPage = proxy(accountRequest());
  const signedOutLocation = signedOutPage.headers.get("location");
  assert(signedOutPage.status === 307 || signedOutPage.status === 303, "a signed-out account visit redirects");
  assert(
    signedOutLocation != null && new URL(signedOutLocation).pathname === "/sign-in",
    "a signed-out account visit goes to sign-in",
  );
  assert(signedOutPage.headers.get("cache-control") === ACCOUNT_CACHE_CONTROL, "a signed-out account visit is not stored");

  console.log("entry checks ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
