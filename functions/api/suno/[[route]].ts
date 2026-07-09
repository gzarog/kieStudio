// Suno power features (dedicated Suno API — endpoints verified on docs.kie.ai):
//
//   POST /api/suno/extend             → POST /generate/extend
//   POST /api/suno/stems              → POST /vocal-removal/generate
//   POST /api/suno/wav                → POST /wav/generate
//   POST /api/suno/lyrics             → POST /lyrics
//   POST /api/suno/timestamped-lyrics → POST /generate/get-timestamped-lyrics  (synchronous)
//   GET  /api/suno/status?kind=extend|stems|wav|lyrics&taskId=…
//
// The docs list callBackUrl on the async endpoints, but BYOK has no server state
// to receive callbacks — we rely on each feature's documented record-info poll
// endpoint instead and never send a callBackUrl.
import {
  KIE_BASE, userKey, kieHeaders, noKey, badRequest, json, guard, normalizeStatus,
} from "../_lib";

export { onRequestOptions } from "../_lib";

function action(ctx: Parameters<PagesFunction>[0]): string {
  const r = ctx.params?.route;
  return Array.isArray(r) ? r[0] ?? "" : r ?? "";
}

async function submit(key: string, path: string, body: unknown) {
  const res = await fetch(`${KIE_BASE}${path}`, {
    method: "POST",
    headers: kieHeaders(key),
    body: JSON.stringify(body),
  });
  if (!res.ok) return json({ error: await res.text() }, res.status);
  const data = await res.json<{ code?: number; msg?: string; data?: { taskId?: string } }>();
  if (!data.data?.taskId) return json({ error: data.msg ?? "Suno task not accepted." }, 502);
  return json({ taskId: data.data.taskId });
}

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();
    const kind = action(ctx);
    const b = await ctx.request.json<Record<string, unknown>>();

    switch (kind) {
      case "extend": {
        if (!b.audioId) return badRequest("audioId is required.");
        if (!b.prompt) return badRequest("A prompt describing the extension is required.");
        if (!b.model) return badRequest("The model of the source track is required.");
        const body: Record<string, unknown> = {
          defaultParamFlag: b.defaultParamFlag ?? false,
          audioId: b.audioId,
          prompt: b.prompt,
          model: b.model,
        };
        for (const k of ["style", "title", "continueAt"] as const)
          if (b[k] !== undefined) body[k] = b[k];
        return submit(key, "/generate/extend", body);
      }
      case "stems": {
        if (!b.taskId || !b.audioId) return badRequest("taskId and audioId are required.");
        return submit(key, "/vocal-removal/generate", {
          taskId: b.taskId,
          audioId: b.audioId,
          type: b.type ?? "separate_vocal",
        });
      }
      case "wav": {
        if (!b.taskId || !b.audioId) return badRequest("taskId and audioId are required.");
        return submit(key, "/wav/generate", { taskId: b.taskId, audioId: b.audioId });
      }
      case "lyrics": {
        if (!b.prompt) return badRequest("A prompt is required.");
        return submit(key, "/lyrics", { prompt: b.prompt });
      }
      case "timestamped-lyrics": {
        // Synchronous: returns the aligned words directly, no task to poll.
        if (!b.taskId || !b.audioId) return badRequest("taskId and audioId are required.");
        const res = await fetch(`${KIE_BASE}/generate/get-timestamped-lyrics`, {
          method: "POST",
          headers: kieHeaders(key),
          body: JSON.stringify({ taskId: b.taskId, audioId: b.audioId }),
        });
        if (!res.ok) return json({ error: await res.text() }, res.status);
        const data = await res.json<{
          data?: { alignedWords?: { word: string; startS: number; endS: number }[] };
        }>();
        return json({ alignedWords: data.data?.alignedWords ?? [] });
      }
      default:
        return badRequest(`Unknown Suno action: ${kind || "(none)"}`);
    }
  });

/** Poll endpoint + result extractor per async feature. */
const STATUS_ROUTES: Record<string, { path: string; pick: (d: any) => unknown }> = {
  extend: {
    path: "/generate/record-info",
    pick: (d) => d.response?.sunoData ?? [],
  },
  stems: {
    // response carries vocalUrl/instrumentalUrl (separate_vocal) or the full
    // per-instrument stem URL set (split_stem); pass non-null URLs through.
    path: "/vocal-removal/record-info",
    pick: (d) =>
      Object.fromEntries(Object.entries(d.response ?? {}).filter(([, v]) => Boolean(v))),
  },
  wav: {
    path: "/wav/record-info",
    pick: (d) => ({ audioWavUrl: d.response?.audioWavUrl }),
  },
  lyrics: {
    path: "/lyrics/record-info",
    pick: (d) => d.response?.data ?? [],
  },
};

export const onRequestGet: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const url = new URL(ctx.request.url);
    const taskId = url.searchParams.get("taskId");
    const kind = url.searchParams.get("kind") ?? "";
    if (!taskId) return badRequest("Missing taskId");
    const route = STATUS_ROUTES[kind];
    if (!route) return badRequest(`Unknown status kind: ${kind || "(none)"}`);

    const res = await fetch(`${KIE_BASE}${route.path}?taskId=${encodeURIComponent(taskId)}`, {
      headers: kieHeaders(key),
    });
    const data = await res.json<{
      data: { status?: string; successFlag?: number | string; errorMessage?: string };
    }>();

    const s = normalizeStatus(data.data);
    if (s === "success") return json({ status: "success", result: route.pick(data.data) });
    if (s === "failed")
      return json({ status: "failed", result: null, error: data.data.errorMessage ?? "Task failed" });
    return json({ status: "pending", result: null });
  });
