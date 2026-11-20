import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { setTrafficReader, type Traffic } from "@/lib/agent-traffic";

const storage = new AsyncLocalStorage<Traffic>();

setTrafficReader(() => storage.getStore() ?? null);

export function bindProxyTraffic(userAgent: string, path: string) {
  storage.enterWith({ userAgent, path });
}

export async function requestTraffic(path: string): Promise<Traffic> {
  let userAgent = "";
  try {
    const requestHeaders = await headers();
    userAgent = requestHeaders.get("user-agent") ?? "";
  } catch {
    userAgent = "";
  }
  const traffic = { userAgent, path };
  storage.enterWith(traffic);
  return traffic;
}
