import {
  KIE_CHAT_BASE, userKey, kieHeaders, noKey, badRequest, withCors, guard,
  chatRoute, buildChatBody,
} from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const { model, messages } = await ctx.request.json<{ model: string; messages: unknown[] }>();
    if (!model || !Array.isArray(messages) || messages.length === 0)
      return badRequest("Provide a model and at least one message.");

    const route = chatRoute(model);
    if (!route)
      return badRequest(`Unknown chat model "${model}". Check the model picker.`);

    const upstream = await fetch(`${KIE_CHAT_BASE}${route.path}`, {
      method: "POST",
      headers: kieHeaders(key),
      body: JSON.stringify(buildChatBody(route, model, messages)),
    });

    if (!upstream.ok) {
      return withCors(new Response(await upstream.text(), { status: upstream.status }));
    }

    // kie.ai sometimes wraps errors in HTTP 200 with a JSON body
    // (e.g. {"code":401,"msg":"Unauthorized …"}). A real SSE stream is
    // text/event-stream; an error payload arrives as application/json.
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
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Chat-Protocol": route.protocol,
        },
      })
    );
  });
