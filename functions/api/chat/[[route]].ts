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

    // kie.ai sometimes wraps errors in HTTP 200 with a JSON body
    // (e.g. {"code":401,"msg":"Unauthorized …"}). Detect this by
    // checking Content-Type: a real SSE stream is text/event-stream,
    // while an error payload arrives as application/json.
    const ct = upstream.headers.get("Content-Type") ?? "";
    if (!ct.includes("text/event-stream")) {
      const text = await upstream.text();
      let status = 502;
      try {
        const j = JSON.parse(text);
        if (typeof j.code === "number" && j.code !== 200) status = j.code;
      } catch { /* not JSON — use 502 */ }
      return withCors(new Response(text, { status }));
    }

    return withCors(
      new Response(upstream.body, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      })
    );
  });
