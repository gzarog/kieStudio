// Per-page result history, persisted to localStorage (BYOK: nothing server-side).
// kie.ai retains generated media for 14 days (Jobs recordInfo URLs may expire
// even sooner) — every entry carries a createdAt so the UI can show an expiry
// badge and nudge the user to download promptly.

const PREFIX = "kie.history.";
const MAX_ENTRIES = 50;
export const RETENTION_DAYS = 14;

export function loadHistory<T>(page: string): T[] {
  try {
    const raw = localStorage.getItem(PREFIX + page);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistory<T>(page: string, items: T[]) {
  try {
    localStorage.setItem(PREFIX + page, JSON.stringify(items.slice(0, MAX_ENTRIES)));
  } catch {
    /* storage full / unavailable — history stays session-only */
  }
}

/** Whole days until the 14-day retention window closes (may be negative). */
export function daysLeft(createdAt: number): number {
  const elapsedDays = (Date.now() - createdAt) / 86_400_000;
  return Math.ceil(RETENTION_DAYS - elapsedDays);
}

export function expiryLabel(createdAt: number): string {
  const d = daysLeft(createdAt);
  if (d <= 0) return "may have expired";
  if (d === 1) return "expires within a day";
  return `expires in ${d} days`;
}
