/** Where a signed-in or signed-out visitor goes before the page renders. */
export function entryRedirect(pathname: "/sign-in" | "/account", account: { id: string } | null) {
  switch (pathname) {
    case "/sign-in":
      return account ? "/account" : null;
    case "/account":
      return account ? null : "/sign-in";
    default: {
      const neverPath: never = pathname;
      return neverPath;
    }
  }
}
