// Video generation. Kling / Seedance (and future Market video models) go through
// the Unified Jobs API; Veo 3.1 keeps its dedicated /veo router (distinct
// successFlag/resultUrls response shape, plus its own extend/1080p/4k endpoints).
import {
  KIE_BASE, userKey, kieHeaders, noKey, badRequest, json, guard,
  createJob, jobStatus, jobsModelId, normalizeStatus, parseJobResult,
  readTaskId,
} from "../_lib";

export { onRequestOptions } from "../_lib";

const VEO_MODEL = "veo-3.1";
const VEO_SUBMIT = "/veo/generate";
const VEO_STATUS = "/veo/record-info";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{
      prompt: string; model: string; input?: Record<string, unknown>;
    }>();
    if (!b.prompt?.trim()) return badRequest("Prompt is required.");

    const input = { prompt: b.prompt, ...(b.input ?? {}) };
    const res =
      b.model === VEO_MODEL
        ? await fetch(`${KIE_BASE}${VEO_SUBMIT}`, {
            method: "POST", headers: kieHeaders(key), body: JSON.stringify(input),
          })
        : await createJob(key, jobsModelId(b.model), input);

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

    const url = new URL(ctx.request.url);
    const taskId = url.searchParams.get("taskId");
    if (!taskId) return badRequest("Missing taskId");

    // Veo 3.1 uses its dedicated record-info endpoint and response shape.
    if (url.searchParams.get("model") === VEO_MODEL) {
      const res = await fetch(`${KIE_BASE}${VEO_STATUS}?taskId=${encodeURIComponent(taskId)}`, {
        headers: kieHeaders(key),
      });
      const data = await res.json<{
        code?: number; msg?: string;
        data?: {
          status?: string; state?: string; successFlag?: number; errorMessage?: string;
          response?: { videoUrl?: string; resultUrls?: string[] };
        } | null;
      }>();
      if (!data.data) return json({ status: "failed", result: null, error: data.msg ?? "Status unavailable" });
      const s = normalizeStatus(data.data);
      if (s === "success") {
        const videoUrl = data.data.response?.videoUrl ?? data.data.response?.resultUrls?.[0];
        return json({ status: "success", result: { videoUrl } });
      }
      if (s === "failed")
        return json({ status: "failed", result: null, error: data.data.errorMessage });
      return json({ status: "pending", result: null });
    }

    // Everything else goes through the Unified Jobs API.
    const res = await jobStatus(key, taskId);
    const data = await res.json<{
      code?: number; msg?: string;
      data?: { state?: string; status?: string; failMsg?: string; resultJson?: string } | null;
    }>();
    if (!data.data) return json({ status: "failed", result: null, error: data.msg ?? "Status unavailable" });
    const s = normalizeStatus(data.data);
    if (s === "success") {
      const { resultUrls } = parseJobResult(data.data.resultJson);
      return json({ status: "success", result: { videoUrl: resultUrls[0], resultUrls } });
    }
    if (s === "failed")
      return json({ status: "failed", result: null, error: data.data.failMsg ?? "Generation failed" });
    return json({ status: "pending", result: null });
  });
