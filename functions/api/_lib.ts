// ─────────────────────────────────────────────────────────────────────────────
// kie.ai endpoint contracts (base: https://api.kie.ai/api/v1)
//
// VERIFIED against KIE-API-VERIFIED.md (docs.kie.ai, 2026-07-09).
//
// Unified Jobs API (all Market models — image, most video, TTS, …):
//   Submit:  POST /jobs/createTask   body { model, input, callBackUrl? } → { code, msg, data:{ taskId } }
//   Poll:    GET  /jobs/recordInfo?taskId=<id>
//            data.state ∈ waiting | queuing | generating | success | fail   (LOWERCASE)
//            data.resultJson is a STRINGIFIED JSON — JSON.parse it, read resultUrls[]
//            generated URLs may expire in as little as 24h; account media retention 14d
//
// Dedicated routers (kept separate — verified distinct contracts):
//   Chat:  POST /chat/completions           (OpenAI-compatible SSE)
//   Suno:  POST /generate + GET /generate/record-info
//   Veo:   POST /veo/generate + GET /veo/record-info   (successFlag/resultUrls shape)
//
// BYOK invariant: the user key arrives as `X-KIE-Key`, is forwarded as
// `Authorization: Bearer <key>`, and is never stored or logged server-side.
// ─────────────────────────────────────────────────────────────────────────────

export const KIE_BASE = "https://api.kie.ai/api/v1";

// ── Unified Jobs API ─────────────────────────────────────────────────────────

export const JOBS_CREATE = "/jobs/createTask";
export const JOBS_STATUS = "/jobs/recordInfo";

/**
 * Friendly model key (used by the frontend / legacy routes) → the exact,
 * VERIFIED Jobs API `model` identifier. Naming is NOT uniform across providers,
 * so these strings are copied verbatim from KIE-API-VERIFIED.md — never inferred.
 * Additional Market models are added frontend-side via the generic /api/jobs route.
 */
export const JOBS_MODEL_IDS: Record<string, string> = {
  "gpt-image-2": "gpt-image-2-text-to-image",
  "nano-banana": "nano-banana-pro",
  "kling-3.0": "kling-3.0/video",
  "seedance-2.0": "bytedance/seedance-2",
};

/** Resolve a friendly key to its Jobs identifier; pass through already-exact ids. */
export function jobsModelId(model?: string): string {
  return (model && JOBS_MODEL_IDS[model]) || model || "";
}

/** Submit a Jobs API task. Returns the raw fetch Response (caller reads data.taskId). */
export function createJob(key: string, model: string, input: unknown, callBackUrl?: string) {
  const body: Record<string, unknown> = { model, input };
  if (callBackUrl) body.callBackUrl = callBackUrl;
  return fetch(`${KIE_BASE}${JOBS_CREATE}`, {
    method: "POST",
    headers: kieHeaders(key),
    body: JSON.stringify(body),
  });
}

/** Poll a Jobs API task by id. Returns the raw fetch Response. */
export function jobStatus(key: string, taskId: string) {
  return fetch(`${KIE_BASE}${JOBS_STATUS}?taskId=${encodeURIComponent(taskId)}`, {
    headers: kieHeaders(key),
  });
}

/**
 * recordInfo returns `resultJson` as a STRINGIFIED JSON blob. Parse it defensively
 * and pull out the media URLs, tolerating both `resultUrls` and `result_urls`.
 */
export function parseJobResult(resultJson?: string | null): { resultUrls: string[] } {
  if (!resultJson) return { resultUrls: [] };
  try {
    const parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
    const urls = parsed?.resultUrls ?? parsed?.result_urls ?? [];
    return { resultUrls: Array.isArray(urls) ? urls.filter(Boolean) : [] };
  } catch {
    return { resultUrls: [] };
  }
}

// ── Auth / headers ───────────────────────────────────────────────────────────

export function userKey(request: Request): string | null {
  return request.headers.get("X-KIE-Key");
}

export function kieHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-KIE-Key",
  "Access-Control-Max-Age": "86400",
};

/** Add permissive CORS headers to any Response (BYOK — no cookies/credentials). */
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Shared OPTIONS handler for every route (preflight). */
export const onRequestOptions: PagesFunction = async () =>
  new Response(null, { status: 204, headers: CORS_HEADERS });

// ── JSON response helpers (always CORS-wrapped) ──────────────────────────────

export function json(body: unknown, status = 200): Response {
  return withCors(Response.json(body, { status }));
}

export const noKey = () =>
  json({ error: "Missing kie.ai API key. Add it in Settings." }, 401);

export const badRequest = (msg: string) => json({ error: msg }, 400);

/** Wrap a handler so any thrown error becomes a clean, CORS-safe 500 (never leaks the key). */
export async function guard(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected server error";
    return json({ error: message }, 500);
  }
}

// ── Status normalization ─────────────────────────────────────────────────────

export type NormalizedStatus = "pending" | "success" | "failed";

/**
 * Map kie.ai's varied status shapes to our 3-state contract.
 * Handles the Jobs API `state` (lowercase: waiting|queuing|generating|success|fail),
 * the dedicated routers' `status` (SUCCESS|FAILED|GENERATING), and the Veo-style
 * `successFlag` (1 = success, 2/3 = failed, 0 = pending).
 */
export function normalizeStatus(data: {
  status?: string;
  state?: string;
  successFlag?: number | string;
}): NormalizedStatus {
  const raw = String(data.status ?? data.state ?? "").toUpperCase();

  if (raw === "SUCCESS" || raw === "COMPLETED" || raw === "SUCCEED") return "success";
  if (
    raw === "FAIL" ||
    raw === "FAILED" ||
    raw === "ERROR" ||
    raw.includes("ERROR") ||
    raw === "CANCELED"
  )
    return "failed";

  // Some video models (Veo) report only successFlag: 1 = done, 2/3 = failed, 0 = pending.
  if (data.successFlag !== undefined) {
    const flag = Number(data.successFlag);
    if (flag === 1) return "success";
    if (flag === 2 || flag === 3) return "failed";
  }

  return "pending"; // waiting, queuing, generating, WAITING, PENDING, "", …
}
