// Tiny global credits store: the header shows the remaining kie.ai credits,
// refreshed after key validation and after every completed task.
import { validateKey } from "./kieClient";
import { hasApiKey } from "./apiKey";

let current: number | null = null;
const listeners = new Set<(credits: number | null) => void>();

export function subscribeCredits(l: (credits: number | null) => void): () => void {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

export function setCredits(credits: number | null) {
  current = credits;
  for (const l of listeners) l(current);
}

/** Re-query the Common API credits endpoint (via /validate) and broadcast. */
export async function refreshCredits(): Promise<void> {
  if (!hasApiKey()) return;
  try {
    const { valid, credits } = await validateKey();
    if (valid && typeof credits === "number") setCredits(credits);
  } catch {
    /* keep the last known value */
  }
}
