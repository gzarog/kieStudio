// ─────────────────────────────────────────────────────────────────────────────
// kie.ai endpoint contracts (base: https://api.kie.ai/api/v1)
//
// | Feature | Submit                          | Status (poll)                         | Status field / values                 |
// |---------|---------------------------------|---------------------------------------|---------------------------------------|
// | Chat    | POST /chat/completions          | — (SSE stream, OpenAI-compatible)     | n/a                                    |
// | Music   | POST /generate                  | GET /generate/record-info?taskId=     | data.status: GENERATING|SUCCESS|FAILED |
// | Image   | POST <per-model>/generate       | GET <per-model>/record-info?taskId=   | data.status: GENERATING|SUCCESS|FAILED |
// | Video   | POST <per-model>/generate       | GET <per-model>/record-info?taskId=   | data.status / state / successFlag      |
//
// NOTE: Live verification (Phase 1) is BLOCKED — docs.kie.ai is auth-gated (403)
// and no TEST_KIE_KEY is available in this environment. The per-model routing
// below reflects the documented conventions; adjust the ENDPOINTS values once a
// real key is available and a submit call returns a taskId. Status parsing is
// normalized defensively via `normalizeStatus` so unexpected casings still map.
// ─────────────────────────────────────────────────────────────────────────────

export const KIE_BASE = "https://api.kie.ai/api/v1";

/** Per-model submit/status paths (relative to KIE_BASE). */
export type EndpointPair = { submit: string; status: string };

export const IMAGE_ENDPOINTS: Record<string, EndpointPair> = {
  "gpt-image-2": { submit: "/gpt4o-image/generate", status: "/gpt4o-image/record-info" },
  "nano-banana": { submit: "/nano-banana/generate", status: "/nano-banana/record-info" },
};

export const VIDEO_ENDPOINTS: Record<string, EndpointPair> = {
  "veo-3.1": { submit: "/veo/generate", status: "/veo/record-info" },
  "kling-3.0": { submit: "/kling/generate", status: "/kling/record-info" },
  "seedance-2.0": { submit: "/seedance/generate", status: "/seedance/record-info" },
};

/** Generic fallback used when a model isn't in the per-model maps. */
export const IMAGE_FALLBACK: EndpointPair = { submit: "/image/generate", status: "/image/record-info" };
export const VIDEO_FALLBACK: EndpointPair = { submit: "/video/generate", status: "/video/record-info" };

export function imageEndpoint(model?: string): EndpointPair {
  return (model && IMAGE_ENDPOINTS[model]) || IMAGE_FALLBACK;
}
export function videoEndpoint(model?: string): EndpointPair {
  return (model && VIDEO_ENDPOINTS[model]) || VIDEO_FALLBACK;
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
 * Handles: data.status (SUCCESS/FAILED/GENERATING), data.state,
 * data.successFlag (1 = success, 0/2/3 = failed), and *_ERROR strings.
 */
export function normalizeStatus(data: {
  status?: string;
  state?: string;
  successFlag?: number | string;
}): NormalizedStatus {
  const raw = String(data.status ?? data.state ?? "").toUpperCase();

  if (raw === "SUCCESS" || raw === "COMPLETED" || raw === "SUCCEED") return "success";
  if (raw === "FAILED" || raw === "ERROR" || raw.includes("ERROR") || raw === "CANCELED")
    return "failed";

  // Some video models report only successFlag: 1 = done, 2/3 = failed, 0 = pending.
  if (data.successFlag !== undefined) {
    const flag = Number(data.successFlag);
    if (flag === 1) return "success";
    if (flag === 2 || flag === 3) return "failed";
  }

  return "pending"; // GENERATING, WAITING, QUEUEING, PENDING, "", …
}
