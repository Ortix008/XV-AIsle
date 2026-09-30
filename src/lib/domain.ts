/** Name to register and point at the host. The live address is still APP_URL. */
export const STORE_HOST = "xvaisle.com";
export const STORE_ORIGIN = "https://xvaisle.com";

export function storefrontUrl(origin: string) {
  const clean = origin.replace(/\/$/, "");
  if (clean.endsWith(STORE_HOST) || clean.endsWith(`www.${STORE_HOST}`)) return `${clean}/shop`;
  return `${STORE_ORIGIN}/shop`;
}
