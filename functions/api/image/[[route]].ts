// Image generation via the Unified Jobs API. The friendly model key from the
// frontend (e.g. "nano-banana", "gpt-image-2") is mapped to its verified Jobs
// identifier in _lib. Any caller-supplied `input` fields are merged over the prompt.
import {
  userKey, noKey, badRequest, json, guard,
  createJob, jobStatus, jobsModelId, normalizeStatus, parseJobResult,
  readTaskId,
} from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{
      prompt: string; model: string; input?: Record<string, unknown>;
    }>();
    // Prompt-optional models (e.g. background removal) may send only `input`.
    if (!b.prompt?.trim() && !Object.keys(b.input ?? {}).length)
      return badRequest("Prompt is required.");

    const input = { ...(b.prompt?.trim() ? { prompt: b.prompt } : {}), ...(b.input ?? {}) };
    const res = await createJob(key, jobsModelId(b.model), input);
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

    const res = await jobStatus(key, taskId);
    const data = await res.json<{
      code?: number; msg?: string;
      data?: { state?: string; status?: string; failMsg?: string; resultJson?: string } | null;
    }>();
    if (!data.data) return json({ status: "failed", result: null, error: data.msg ?? "Status unavailable" });
    const s = normalizeStatus(data.data);
    if (s === "success") {
      const { resultUrls } = parseJobResult(data.data.resultJson);
      return json({ status: "success", result: { imageUrl: resultUrls[0], resultUrls } });
    }
    if (s === "failed")
      return json({ status: "failed", result: null, error: data.data.failMsg ?? "Generation failed" });
    return json({ status: "pending", result: null });
  });
