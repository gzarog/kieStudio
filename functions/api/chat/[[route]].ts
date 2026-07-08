import { KIE_BASE, userKey, kieHeaders, noKey } from "../_lib";

export const onRequestPost: PagesFunction = async (ctx) => {
  const key = userKey(ctx.request);
  if (!key) return noKey();

  const { model, messages } = await ctx.request.json<{ model: string; messages: unknown[] }>();

  const upstream = await fetch(`${KIE_BASE}/chat/completions`, {
    method: "POST",
    headers: kieHeaders(key),
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 2048 }),
  });

  if (!upstream.ok) {
    return new Response(await upstream.text(), { status: upstream.status });
  }

  return new Response(upstream.body, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
};
