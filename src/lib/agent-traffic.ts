export const AGENT_TOKENS = [
  "Googlebot",
  "Storebot-Google",
  "bingbot",
  "Applebot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Amzn-SearchBot",
  "Amzn-User",
  "meta-webindexer",
  "meta-externalfetcher",
] as const;

export type AgentToken = (typeof AGENT_TOKENS)[number];

export type Traffic = {
  userAgent: string;
  path: string;
};

export type ClickSource = "agent" | "human";

export type AgentClick = {
  timestamp: string;
  path: string;
  network: string;
  id: string;
  source: ClickSource;
  subIdAppended: boolean;
};

type TrackingNetwork = "amazon" | "impact" | "awin" | "cj" | "viator" | "getyourguide" | "zazzle" | "other";

const CLICK_LIMIT = 2000;
const clicks: AgentClick[] = [];
const stack: Traffic[] = [];
let reader: () => Traffic | null = () => null;

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const SAFE_PATH = /^\/[a-z0-9./_-]{0,200}$/;

export function setTrafficReader(next: () => Traffic | null) {
  reader = next;
}

export function currentTraffic() {
  return stack[stack.length - 1] ?? reader();
}

export function runWithTraffic<T>(traffic: Traffic | null | undefined, fn: () => T) {
  if (!traffic) return fn();
  stack.push(traffic);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

export function agentSubIdEnabled(value = process.env.AGENT_SUBID) {
  return (value ?? "on").trim().toLowerCase() !== "off";
}

export function isAgentUserAgent(userAgent: string | null | undefined) {
  if (!userAgent) return false;
  return AGENT_TOKENS.some((token) => userAgent.includes(token));
}

export function agentClickLog() {
  return clicks.map((row) => ({ ...row }));
}

export function clearAgentClickLog() {
  clicks.length = 0;
}

function safePath(path: string) {
  const bare = path.split("?")[0]?.split("#")[0] ?? "";
  return SAFE_PATH.test(bare) ? bare : "";
}

function safeId(id: string) {
  return SAFE_ID.test(id) ? id : "";
}

function recordClick(input: Omit<AgentClick, "timestamp">) {
  const row: AgentClick = {
    timestamp: new Date().toISOString(),
    path: input.path,
    network: input.network,
    id: input.id,
    source: input.source,
    subIdAppended: input.subIdAppended,
  };
  clicks.push(row);
  if (clicks.length > CLICK_LIMIT) clicks.shift();
  return row;
}

function hostname(href: string) {
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function hostIs(host: string, name: string) {
  return host === name || host.endsWith(`.${name}`);
}

function hostIn(host: string, names: readonly string[]) {
  return names.some((name) => hostIs(host, name));
}

export function classifyTrackingHref(href: string): TrackingNetwork {
  const host = hostname(href);
  if (!host) return "other";
  if (hostIn(host, ["amazon.com"])) return "amazon";
  if (hostIn(host, ["viator.com"])) return "viator";
  if (hostIn(host, ["getyourguide.com"])) return "getyourguide";
  if (hostIn(host, ["zazzle.com"])) return "zazzle";
  if (
    hostIn(host, [
      "cj.com",
      "anrdoezrs.net",
      "dpbolvw.net",
      "jdoqocy.com",
      "tkqlhce.com",
      "kqzyfj.com",
      "qksrv.net",
      "emjcd.com",
      "commission-junction.com",
      "dotomi.com",
    ])
  ) {
    return "cj";
  }
  if (hostIn(host, ["awin1.com", "awin.com", "zenaps.com"])) return "awin";
  if (hostIn(host, ["impact.com", "impactradius.com", "sjv.io", "pxf.io", "evyy.net", "7eer.net", "ojrq.net"])) {
    return "impact";
  }
  return "other";
}

function subIdParam(network: TrackingNetwork) {
  switch (network) {
    case "impact":
      return "subId1";
    case "awin":
      return "clickref";
    case "amazon":
    case "cj":
    case "viator":
    case "getyourguide":
    case "zazzle":
    case "other":
      return null;
    default: {
      const neverNetwork: never = network;
      return neverNetwork;
    }
  }
}

function appendQuery(href: string, key: string, value: string) {
  const hashAt = href.indexOf("#");
  const hash = hashAt >= 0 ? href.slice(hashAt) : "";
  const base = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = base.indexOf("?");
  if (queryAt < 0) return `${base}?${key}=${value}${hash}`;
  const query = base.slice(queryAt + 1);
  const exists = query.split("&").some((part) => {
    const name = part.split("=")[0] ?? "";
    try {
      return decodeURIComponent(name) === key;
    } catch {
      return name === key;
    }
  });
  if (exists) return href;
  return `${base}${query === "" ? "" : "&"}${key}=${value}${hash}`;
}

/** Rewrites Impact and Awin hrefs when the switch is on. Amazon and the other named networks stay as given. */
export function servedTrackingHref(href: string, id: string, traffic: Traffic | null = currentTraffic()) {
  if (!href) return href;
  const network = classifyTrackingHref(href);
  const agent = isAgentUserAgent(traffic?.userAgent);
  const param = agent && agentSubIdEnabled() ? subIdParam(network) : null;
  const next = param ? appendQuery(href, param, "agent") : href;
  recordClick({
    path: safePath(traffic?.path ?? ""),
    network,
    id: safeId(id),
    source: agent ? "agent" : "human",
    subIdAppended: next !== href,
  });
  return next;
}
