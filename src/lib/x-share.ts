import { RESELLER_DISCLOSURE } from "./policies";

function shareTarget(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Share URL must be http(s).");
  }
  if (url.username || url.password) throw new Error("Share URL must be http(s).");
  return url;
}

export function xIntentUrl(input: { text: string; url: string }) {
  const target = shareTarget(input.url);
  const params = new URLSearchParams({ text: input.text, url: target.toString() });
  return `https://x.com/intent/post?${params.toString()}`;
}

export function buyerShareHref(input: { title: string; productUrl: string }) {
  const target = shareTarget(input.productUrl);
  target.searchParams.delete("ref");
  return xIntentUrl({ text: input.title, url: target.toString() });
}

export function resellerShareHref(input: { title: string; productUrl: string; accountId: string }) {
  const target = shareTarget(input.productUrl);
  target.searchParams.set("ref", input.accountId);
  return xIntentUrl({
    text: `${input.title}\n${RESELLER_DISCLOSURE}`,
    url: target.toString(),
  });
}
