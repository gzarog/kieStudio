import { vi } from "vitest";

/**
 * Build a minimal Pages Function context around a real Request.
 * Only `request` is consumed by the handlers under test.
 */
export function makeCtx(request: Request): any {
  return { request, env: {}, params: {}, waitUntil: () => {}, next: async () => new Response() };
}

/** Convenience: build a Request with the BYOK key header set (unless key === null). */
export function req(
  url: string,
  init: RequestInit & { key?: string | null } = {}
): Request {
  const { key = "test-key", headers, ...rest } = init;
  const h = new Headers(headers);
  if (key !== null) h.set("X-KIE-Key", key);
  return new Request(url, { ...rest, headers: h });
}

/** A Response-like value good enough for the code paths under test. */
export function fetchResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; text?: string } = {}
): Response {
  const status = init.status ?? (init.ok === false ? 500 : 200);
  const ok = init.ok ?? (status >= 200 && status < 300);
  const jsonBody = body;
  return {
    ok,
    status,
    statusText: "",
    json: async () => jsonBody,
    text: async () => init.text ?? (typeof body === "string" ? body : JSON.stringify(body)),
  } as unknown as Response;
}

/** Install a mocked global fetch that returns the given queued responses in order. */
export function mockFetchSequence(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

/** Build a ReadableStream that emits the given string chunks (for SSE tests). */
export function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });
}
