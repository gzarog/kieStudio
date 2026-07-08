import {
  KIE_BASE, userKey, kieHeaders, noKey, badRequest, json, guard, normalizeStatus,
} from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{ prompt: string; model: string; instrumental: boolean }>();
    if (!b.prompt?.trim()) return badRequest("Prompt is required.");

    const res = await fetch(`${KIE_BASE}/generate`, {
      method: "POST",
      headers: kieHeaders(key),
      body: JSON.stringify({ prompt: b.prompt, customMode: false, instrumental: b.instrumental, model: b.model }),
    });
    if (!res.ok) return json({ error: await res.text() }, res.status);
    const data = await res.json<{ data: { taskId: string } }>();
    return json({ taskId: data.data.taskId });
  });

export const onRequestGet: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const taskId = new URL(ctx.request.url).searchParams.get("taskId");
    if (!taskId) return badRequest("Missing taskId");

    const res = await fetch(`${KIE_BASE}/generate/record-info?taskId=${encodeURIComponent(taskId)}`, {
      headers: kieHeaders(key),
    });
    const data = await res.json<{
      data: { status?: string; state?: string; successFlag?: number; errorMessage?: string; response?: { sunoData: unknown[] } };
    }>();

    const s = normalizeStatus(data.data);
    if (s === "success") return json({ status: "success", result: data.data.response?.sunoData ?? [] });
    if (s === "failed") return json({ status: "failed", result: null, error: data.data.errorMessage });
    return json({ status: "pending", result: null });
  });
