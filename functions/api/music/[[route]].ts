import {
  KIE_BASE, userKey, kieHeaders, noKey, badRequest, json, guard, normalizeStatus,
  readTaskId,
} from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{
      prompt?: string; model: string; instrumental?: boolean; customMode?: boolean;
      style?: string; title?: string; negativeTags?: string; vocalGender?: string;
      styleWeight?: number; weirdnessConstraint?: number; audioWeight?: number;
    }>();

    const customMode = !!b.customMode;
    const instrumental = !!b.instrumental;
    if (customMode) {
      // Custom mode needs style + title; lyrics (prompt) only when not instrumental.
      if (!b.style?.trim()) return badRequest("Style is required in custom mode.");
      if (!b.title?.trim()) return badRequest("Title is required in custom mode.");
      if (!instrumental && !b.prompt?.trim())
        return badRequest("Lyrics (prompt) are required for a vocal track in custom mode.");
    } else if (!b.prompt?.trim()) {
      return badRequest("Prompt is required.");
    }

    // BYOK: never send callBackUrl — we poll record-info instead. Copy each
    // optional param through only when the client supplied it.
    const body: Record<string, unknown> = { customMode, instrumental, model: b.model };
    if (b.prompt !== undefined) body.prompt = b.prompt;
    for (const k of ["style", "title", "negativeTags", "vocalGender", "styleWeight", "weirdnessConstraint", "audioWeight"] as const)
      if (b[k] !== undefined) body[k] = b[k];

    const res = await fetch(`${KIE_BASE}/generate`, {
      method: "POST",
      headers: kieHeaders(key),
      body: JSON.stringify(body),
    });
    if (!res.ok) return json({ error: await res.text() }, res.status);
    const envelope = await res.json<{ code?: number; msg?: string; data?: { taskId?: string } | null }>();
    const tid = readTaskId(envelope);
    if (tid instanceof Response) return tid;
    return json({ taskId: tid.taskId });
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
      code?: number; msg?: string;
      data?: { status?: string; state?: string; successFlag?: number; errorMessage?: string; response?: { sunoData: unknown[] } } | null;
    }>();
    if (!data.data) return json({ status: "failed", result: null, error: data.msg ?? "Status unavailable" });
    const s = normalizeStatus(data.data);
    if (s === "success") return json({ status: "success", result: data.data.response?.sunoData ?? [] });
    if (s === "failed") return json({ status: "failed", result: null, error: data.data.errorMessage });
    return json({ status: "pending", result: null });
  });
