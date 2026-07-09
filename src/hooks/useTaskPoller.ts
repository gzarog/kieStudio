import { useState, useRef, useCallback, useEffect } from "react";
import { getFromWorker, RateLimitError } from "../lib/kieClient";
import { refreshCredits } from "../lib/credits";
import { toast } from "../lib/ui";
import type { TaskStatus } from "../lib/types";

// Rate-limit backoff caps at interval × 2⁴ (e.g. 4s → 64s between polls).
const MAX_BACKOFF_EXP = 4;

export function useTaskPoller<T>(statusPath: string, intervalMs = 4000) {
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  const stop = useCallback(() => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; stop(); };
  }, [stop]);

  // `params` carries extra query fields (e.g. { model }) so the worker can route
  // per-model status endpoints.
  const startPolling = useCallback((taskId: string, params: Record<string, string> = {}) => {
    stop();
    setStatus("pending"); setResult(null); setError("");
    const query = new URLSearchParams({ taskId, ...params }).toString();
    let backoffExp = 0;
    let warnedRateLimit = false;

    const poll = async () => {
      try {
        const d = await getFromWorker<{ status: string; result: T | null; error?: string }>(
          `${statusPath}?${query}`
        );
        backoffExp = 0;
        if (d.status === "success") {
          if (alive.current) { setStatus("success"); setResult(d.result); }
          refreshCredits(); // header credits reflect the completed task
          return;
        }
        if (d.status === "failed") {
          if (alive.current) { setStatus("failed"); setError(d.error ?? "Generation failed"); }
          return;
        }
      } catch (e) {
        if (e instanceof RateLimitError) {
          // 429 = rejected, not queued — back off exponentially and keep polling.
          backoffExp = Math.min(backoffExp + 1, MAX_BACKOFF_EXP);
          if (!warnedRateLimit) {
            toast("Rate limited by kie.ai — retrying with backoff…", "info");
            warnedRateLimit = true;
          }
        } else {
          if (alive.current) {
            setStatus("failed");
            setError(e instanceof Error ? e.message : String(e));
          }
          return;
        }
      }
      if (alive.current) timer.current = setTimeout(poll, intervalMs * 2 ** backoffExp);
    };

    timer.current = setTimeout(poll, intervalMs);
  }, [statusPath, intervalMs, stop]);

  return { status, result, error, startPolling };
}
