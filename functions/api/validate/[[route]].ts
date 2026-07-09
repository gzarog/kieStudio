import { KIE_BASE, userKey, kieHeaders, noKey, json, guard } from "../_lib";

export { onRequestOptions } from "../_lib";

// Verify the user's key with the cheapest signal available. Prefer an account /
// credits lookup; if kie.ai doesn't expose one for this key, fall back to a
// 1-token chat completion. Either way we only report { valid, credits? } —
// never the key, never the raw upstream body.
export const onRequestGet: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    // 1) Try a credits/account endpoint (no charge).
    try {
      const res = await fetch(`${KIE_BASE}/chat/credit`, { headers: kieHeaders(key) });
      if (res.ok) {
        // Verified Common API shape: GET /chat/credit → { code, msg, data: <number> }.
        // Tolerate older object shapes too.
        const data = await res.json<{
          data?: number | { credits?: number; remainingCredits?: number };
        }>();
        const d = data.data;
        const credits = typeof d === "number" ? d : d?.remainingCredits ?? d?.credits;
        return json({ valid: true, credits });
      }
      // 401/403 → key is definitively bad; don't bother with the fallback.
      if (res.status === 401 || res.status === 403) return json({ valid: false });
    } catch {
      /* fall through to chat probe */
    }

    // 2) Fallback: a minimal chat call. 2xx means the key authenticates.
    const probe = await fetch(`${KIE_BASE}/chat/completions`, {
      method: "POST",
      headers: kieHeaders(key),
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: "hi" }],
        max_tokens: 1,
      }),
    });
    return json({ valid: probe.ok });
  });
