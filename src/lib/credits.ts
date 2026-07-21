// Tiny global credits store: the header shows the remaining kie.ai credits,
// refreshed after key validation and after every completed task.
import { validateKey } from "./kieClient";
import { hasApiKey } from "./apiKey";
import { toast } from "./ui";

let current: number | null = null;
const listeners = new Set<(credits: number | null) => void>();

export function subscribeCredits(l: (credits: number | null) => void): () => void {
  listeners.add(l);
  l(current);
  return () => listeners.delete(l);
}

export function setCredits(credits: number | null) {
  const prev = current;
  current = credits;
  if (prev !== null && credits !== null && credits < prev) {
    toast(`−${prev - credits} credits`, "info", 3000);
  }
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
