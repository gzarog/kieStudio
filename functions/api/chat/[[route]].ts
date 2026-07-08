import { KIE_BASE, userKey, kieHeaders, noKey, badRequest, withCors, guard } from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const { model, messages } = await ctx.request.json<{ model: string; messages: unknown[] }>();
    if (!model || !Array.isArray(messages) || messages.length === 0)
      return badRequest("Provide a model and at least one message.");

    const upstream = await fetch(`${KIE_BASE}/chat/completions`, {
      method: "POST",
      headers: kieHeaders(key),
      body: JSON.stringify({ model, messages, stream: true, max_tokens: 2048 }),
    });

    // Pass kie.ai's error body through verbatim — it carries credit / rate-limit info.
    if (!upstream.ok) {
      return withCors(new Response(await upstream.text(), { status: upstream.status }));
    }

    return withCors(
      new Response(upstream.body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      })
    );
  });
