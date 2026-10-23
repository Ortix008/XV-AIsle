/** Sign out leaves the account page for the signed-out screen. */
export const SIGNED_OUT_PATH = "/sign-in";

/** Keep /account out of the browser and CDN cache, including a back navigation. */
export const ACCOUNT_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";

/** A restored /account document can still paint the previous signed-in screen. */
export function accountRestoreNeedsReload(pathname: string, persisted: boolean) {
  return persisted && pathname === "/account";
}
