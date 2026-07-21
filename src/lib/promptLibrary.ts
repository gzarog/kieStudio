// Per-category prompt library: save/star prompts + auto-record recent submissions.

const SAVED_PREFIX = "kie.prompts.saved.";
const RECENT_PREFIX = "kie.prompts.recent.";
const MAX_SAVED = 100;
const MAX_RECENT = 20;

export interface SavedPrompt { text: string; savedAt: number }

function load<T>(key: string): T[] {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : []; } catch { return []; }
}

function store(key: string, items: unknown[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
}

export function getSavedPrompts(category: string): SavedPrompt[] {
  return load(SAVED_PREFIX + category);
}

export function savePrompt(category: string, text: string) {
  const items = getSavedPrompts(category).filter((p) => p.text !== text);
  items.unshift({ text, savedAt: Date.now() });
  store(SAVED_PREFIX + category, items.slice(0, MAX_SAVED));
}

export function removeSavedPrompt(category: string, text: string) {
  store(SAVED_PREFIX + category, getSavedPrompts(category).filter((p) => p.text !== text));
}

export function getRecentPrompts(category: string): string[] {
  return load(RECENT_PREFIX + category);
}

export function recordPrompt(category: string, text: string) {
  if (!text.trim()) return;
  const items = getRecentPrompts(category).filter((p) => p !== text);
  items.unshift(text);
  store(RECENT_PREFIX + category, items.slice(0, MAX_RECENT));
}
