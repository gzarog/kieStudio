import {
  KIE_BASE, userKey, kieHeaders, noKey, badRequest, json, guard,
  imageEndpoint, normalizeStatus,
} from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{ prompt: string; model: string; size: string }>();
    if (!b.prompt?.trim()) return badRequest("Prompt is required.");

    const { submit } = imageEndpoint(b.model);
    const res = await fetch(`${KIE_BASE}${submit}`, {
      method: "POST", headers: kieHeaders(key), body: JSON.stringify(b),
    });
    if (!res.ok) return json({ error: await res.text() }, res.status);
    const data = await res.json<{ data: { taskId: string } }>();
    return json({ taskId: data.data.taskId });
  });

export const onRequestGet: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const url = new URL(ctx.request.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return badRequest("Missing taskId");

    const { status } = imageEndpoint(url.searchParams.get("model") ?? undefined);
    const res = await fetch(`${KIE_BASE}${status}?taskId=${encodeURIComponent(taskId)}`, {
      headers: kieHeaders(key),
    });
    const data = await res.json<{
      data: {
        status?: string; state?: string; successFlag?: number; errorMessage?: string;
        response?: { imageUrl?: string; resultUrls?: string[] };
      };
    }>();

    const s = normalizeStatus(data.data);
    if (s === "success") {
      const imageUrl = data.data.response?.imageUrl ?? data.data.response?.resultUrls?.[0];
      return json({ status: "success", result: { imageUrl } });
    }
    if (s === "failed")
      return json({ status: "failed", result: null, error: data.data.errorMessage });
    return json({ status: "pending", result: null });
  });
