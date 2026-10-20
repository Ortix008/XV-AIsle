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

  const proxy = readFileSync(new URL("../src/proxy.ts", import.meta.url), "utf8");
  assert(proxy.includes("entryRedirect"), "the proxy redirects before the page renders");
  assert(proxy.includes("NextResponse.redirect"), "sign-in and account use an HTTP redirect");

  console.log("entry checks ok");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
