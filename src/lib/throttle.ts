// Client-side token bucket to stay under kie.ai's 20 req/10s rate limit.
// Prevents bursts (compare mode, bulk downloads) from triggering server 429s.

const MAX_TOKENS = 18;
const REFILL_INTERVAL_MS = 500; // 1 token per 500ms = 20/10s
let tokens = MAX_TOKENS;
let lastRefill = Date.now();

function refill() {
  const now = Date.now();
  const elapsed = now - lastRefill;
  const add = Math.floor(elapsed / REFILL_INTERVAL_MS);
  if (add > 0) {
    tokens = Math.min(MAX_TOKENS, tokens + add);
    lastRefill = now;
  }
}

export function acquireToken(): Promise<void> {
  refill();
  if (tokens > 0) {
    tokens--;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const id = setInterval(() => {
      refill();
      if (tokens > 0) {
        tokens--;
        clearInterval(id);
        resolve();
      }
    }, REFILL_INTERVAL_MS);
  });
}
