import { WAITLIST_SAVED } from "./waitlist-copy";

const RETRY = "Try again.";

/**
 * Posts the waitlist form. A rejected or aborted request resolves with the
 * retry line so the button cannot stay on "Sending…".
 */
export async function submitResellerWaitlist(
  email: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<{ ok: boolean; message: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl("/api/store/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (response.ok) return { ok: true, message: WAITLIST_SAVED };
    return { ok: false, message: data?.error ?? RETRY };
  } catch {
    return { ok: false, message: RETRY };
  } finally {
    clearTimeout(timer);
  }
}
