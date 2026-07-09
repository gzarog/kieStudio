import { getApiKey } from "./apiKey";

const headers = () => ({
  "Content-Type": "application/json",
  "X-KIE-Key": getApiKey(),
});

/**
 * kie.ai allows 20 new generation requests / 10s per account; a 429 means the
 * request was REJECTED (not queued). Callers can catch this type to back off
 * and retry instead of failing the task (see useTaskPoller).
 */
export class RateLimitError extends Error {
  constructor(message = "Rate limited by kie.ai (20 requests / 10s) — retrying shortly.") {
    super(message);
    this.name = "RateLimitError";
  }
}

/** Pull a human-readable message out of a worker/kie.ai error response. */
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const j = JSON.parse(text);
    return j.error ?? j.msg ?? j.message ?? text ?? `Error ${res.status}`;
  } catch {
    return text || `Error ${res.status}`;
  }
}

async function throwFor(res: Response): Promise<never> {
  if (res.status === 429) throw new RateLimitError();
  throw new Error(await errorMessage(res));
}

export async function postToWorker<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) await throwFor(res);
  return res.json();
}

export async function getFromWorker<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: headers() });
  if (!res.ok) await throwFor(res);
  return res.json();
}

export function streamChat(
  model: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal
) {
  return fetch("/api/chat/stream", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ model, messages }),
    signal,
  });
}

export interface ValidateResult { valid: boolean; credits?: number }

/** Ask the worker to verify the current key. Returns { valid:false } on any failure. */
export async function validateKey(): Promise<ValidateResult> {
  try {
    return await getFromWorker<ValidateResult>("/validate");
  } catch {
    return { valid: false };
  }
}
