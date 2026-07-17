// ─────────────────────────────────────────────────────────────────────────────
// kie.ai endpoint contracts
//
// VERIFIED against docs.kie.ai OpenAPI specs (2026-07-17).
//
// Unified Jobs API (base: https://api.kie.ai/api/v1 — all Market models):
//   Submit:  POST /jobs/createTask   body { model, input, callBackUrl? } → { code, msg, data:{ taskId } }
//   Poll:    GET  /jobs/recordInfo?taskId=<id>
//            data.state ∈ waiting | queuing | generating | success | fail   (LOWERCASE)
//            data.resultJson is a STRINGIFIED JSON → parse, read resultUrls[]
//
// Chat (base: https://api.kie.ai — note: NO /api/v1 prefix):
//   Each model family has its own path and SSE protocol:
//     Claude    → POST /claude/v1/messages         (Anthropic Messages SSE)
//     Gemini    → POST /<slug>/v1/chat/completions  (OpenAI chat completions SSE)
//     GPT-5.2   → POST /gpt-5-2/v1/chat/completions (OpenAI chat completions SSE)
//     GPT-5.4+  → POST /codex/v1/responses          (OpenAI Responses SSE)
//     GPT Codex → POST /api/v1/responses             (OpenAI Responses SSE)
//     Grok      → POST /grok/v1/responses            (OpenAI Responses SSE)
//
// Dedicated routers (base: https://api.kie.ai/api/v1):
//   Suno:  POST /generate + GET /generate/record-info
//          extras: /generate/extend, /generate/upload-cover, /vocal-removal/*,
//          /wav/*, /lyrics/*, /style/*, /mp4/*,
//          /generate/get-timestamped-lyrics (see functions/api/suno)
//   Veo:   POST /veo/generate + GET /veo/record-info   (successFlag/resultUrls shape)
//
// Common API:  GET /chat/credit → { code, msg, data: <number> }  (credits display)
// File Upload: POST https://kieai.redpandaai.co/api/file-base64-upload  (separate host)
//
// Rate limit: 20 new generation requests / 10s per account; a 429 is REJECTED,
// not queued (the client backs off and the UI debounces submits).
//
// BYOK invariant: the user key arrives as `X-KIE-Key`, is forwarded as
// `Authorization: Bearer <key>`, and is never stored or logged server-side.
// No webhook callbacks (no server state to receive them) — polling only.
// ─────────────────────────────────────────────────────────────────────────────

export const KIE_BASE = "https://api.kie.ai/api/v1";
export const KIE_CHAT_BASE = "https://api.kie.ai";

// ── Chat routing ─────────────────────────────────────────────────────────────
//
// Three SSE protocols coexist on kie.ai. The Worker maps each model to the
// correct path + protocol so the frontend can parse all of them uniformly.

export type ChatProtocol = "anthropic" | "openai" | "responses";

export interface ChatRoute {
  path: string;
  protocol: ChatProtocol;
}

const CHAT_ROUTES: Record<string, ChatRoute> = {
  // Claude — Anthropic Messages (/claude/v1/messages)
  "claude-opus-4-8":   { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-opus-4-7":   { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-opus-4-6":   { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-opus-4-5":   { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-sonnet-5":   { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-sonnet-4-6": { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-sonnet-4-5": { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-haiku-4-5":  { path: "/claude/v1/messages", protocol: "anthropic" },
  "claude-fable-5":    { path: "/claude/v1/messages", protocol: "anthropic" },

  // Gemini — OpenAI chat completions (per-model slug paths)
  "gemini-2.5-pro":   { path: "/gemini-2.5-pro/v1/chat/completions",   protocol: "openai" },
  "gemini-3-pro":     { path: "/gemini-3-pro/v1/chat/completions",     protocol: "openai" },
  "gemini-3-1-pro":   { path: "/gemini-3.1-pro/v1/chat/completions",   protocol: "openai" },
  "gemini-2-5-flash": { path: "/gemini-2.5-flash/v1/chat/completions", protocol: "openai" },
  "gemini-3-flash":   { path: "/gemini-3-flash/v1/chat/completions",   protocol: "openai" },
  "gemini-3-5-flash": { path: "/gemini-3-5-flash-openai/v1/chat/completions", protocol: "openai" },

  // GPT — mixed: 5.2 uses chat completions, 5.4+ / codex use Responses
  "gpt-4o":       { path: "/gpt-5-2/v1/chat/completions", protocol: "openai" },
  "gpt-5-2":      { path: "/gpt-5-2/v1/chat/completions", protocol: "openai" },
  "gpt-5-4":      { path: "/codex/v1/responses",          protocol: "responses" },
  "gpt-5-5":      { path: "/codex/v1/responses",          protocol: "responses" },
  "gpt-5-codex":  { path: "/api/v1/responses",             protocol: "responses" },

  // Grok — OpenAI Responses
  "grok-4-3": { path: "/grok/v1/responses", protocol: "responses" },
  "grok-4-5": { path: "/grok/v1/responses", protocol: "responses" },
};

export function chatRoute(modelId: string): ChatRoute | undefined {
  return CHAT_ROUTES[modelId];
}

export function buildChatBody(
  route: ChatRoute,
  model: string,
  messages: unknown[],
  maxTokens = 2048,
): Record<string, unknown> {
  switch (route.protocol) {
    case "anthropic":
      return { model, messages, stream: true, max_tokens: maxTokens };
    case "openai":
      return { model, messages, stream: true, max_tokens: maxTokens };
    case "responses":
      return { model, input: messages, stream: true };
  }
}

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

// ── File Upload API ──────────────────────────────────────────────────────────
//
// Separate base host (docs.kie.ai/file-upload-api/quickstart). Same Bearer key.
// We proxy the base64 variant (JSON in, JSON out — no multipart parsing in the
// Worker). Uploaded files get a hosted URL usable as i2i/i2v `input` fields.

export const UPLOAD_BASE = "https://kieai.redpandaai.co";
export const UPLOAD_BASE64 = "/api/file-base64-upload";

/** Forward a base64 data-URL upload to the File Upload API. Returns raw Response. */
export function uploadBase64(
  key: string,
  base64Data: string,
  fileName?: string,
  uploadPath?: string
) {
  const body: Record<string, unknown> = { base64Data };
  if (fileName) body.fileName = fileName;
  if (uploadPath) body.uploadPath = uploadPath;
  return fetch(`${UPLOAD_BASE}${UPLOAD_BASE64}`, {
    method: "POST",
    headers: kieHeaders(key),
    body: JSON.stringify(body),
  });
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
 * the dedicated routers' `status` (SUCCESS | PENDING | TEXT_SUCCESS | FIRST_SUCCESS |
 * CREATE_TASK_FAILED | GENERATE_*_FAILED | SENSITIVE_WORD_ERROR | CALLBACK_EXCEPTION),
 * the Suno wav/vocal-removal `successFlag` STRINGS of the same vocabulary, and the
 * Veo-style numeric `successFlag` (1 = success, 2/3 = failed, 0 = pending).
 */
export function normalizeStatus(data: {
  status?: string;
  state?: string;
  successFlag?: number | string;
}): NormalizedStatus {
  // Suno's wav/vocal-removal record-info reports the status vocabulary through a
  // string `successFlag`; fold it into the same raw-status handling.
  const flagStatus =
    typeof data.successFlag === "string" && Number.isNaN(Number(data.successFlag))
      ? data.successFlag
      : undefined;
  const raw = String(data.status ?? data.state ?? flagStatus ?? "").toUpperCase();

  if (raw === "SUCCESS" || raw === "COMPLETED" || raw === "SUCCEED") return "success";
  if (
    raw === "FAIL" ||
    raw === "ERROR" ||
    raw === "CANCELED" ||
    raw.includes("FAILED") || // FAILED, CREATE_TASK_FAILED, GENERATE_AUDIO/WAV/LYRICS_FAILED
    raw.includes("ERROR") || // SENSITIVE_WORD_ERROR, …
    raw.includes("EXCEPTION") // CALLBACK_EXCEPTION (we never register callbacks)
  )
    return "failed";

  // Some video models (Veo) report only successFlag: 1 = done, 2/3 = failed, 0 = pending.
  if (data.successFlag !== undefined) {
    const flag = Number(data.successFlag);
    if (flag === 1) return "success";
    if (flag === 2 || flag === 3) return "failed";
  }

  return "pending"; // waiting, queuing, generating, PENDING, TEXT_SUCCESS, FIRST_SUCCESS, "", …
}
