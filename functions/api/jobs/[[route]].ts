// Generic Unified Jobs API proxy. Adding any future Market model becomes a
// frontend-only change: submit { model, input } and poll ?taskId=.
//
//   POST /api/jobs/submit  { model, input, callBackUrl? } → { taskId }
//   GET  /api/jobs/status?taskId=<id>                     → { status, result, error }
import {
  userKey, kieHeaders, noKey, badRequest, json, guard,
  createJob, jobStatus, jobsModelId, normalizeStatus, parseJobResult,
} from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{
      model?: string;
      input?: Record<string, unknown>;
      callBackUrl?: string;
    }>();
    if (!b.model?.trim()) return badRequest("A model is required.");
    if (!b.input || typeof b.input !== "object") return badRequest("An input object is required.");

    const res = await createJob(key, jobsModelId(b.model), b.input, b.callBackUrl);
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

    const res = await jobStatus(key, taskId);
    const data = await res.json<{
      data: { state?: string; status?: string; failMsg?: string; failCode?: string; resultJson?: string };
    }>();

    const s = normalizeStatus(data.data);
    if (s === "success") {
      const { resultUrls } = parseJobResult(data.data.resultJson);
      return json({ status: "success", result: { resultUrls } });
    }
    if (s === "failed")
      return json({ status: "failed", result: null, error: data.data.failMsg ?? "Generation failed" });
    return json({ status: "pending", result: null });
  });
