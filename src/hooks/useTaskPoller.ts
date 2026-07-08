import { useState, useRef, useCallback, useEffect } from "react";
import { getFromWorker } from "../lib/kieClient";
import type { TaskStatus } from "../lib/types";

export function useTaskPoller<T>(statusPath: string, intervalMs = 4000) {
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => { if (timer.current) clearInterval(timer.current); }, []);
  useEffect(() => stop, [stop]);

  // `params` carries extra query fields (e.g. { model }) so the worker can route
  // per-model status endpoints.
  const startPolling = useCallback((taskId: string, params: Record<string, string> = {}) => {
    setStatus("pending"); setResult(null); setError("");
    const query = new URLSearchParams({ taskId, ...params }).toString();
    timer.current = setInterval(async () => {
      try {
        const d = await getFromWorker<{ status: string; result: T | null; error?: string }>(
          `${statusPath}?${query}`
        );
        if (d.status === "success") { setStatus("success"); setResult(d.result); stop(); }
        else if (d.status === "failed") { setStatus("failed"); setError(d.error ?? "Generation failed"); stop(); }
      } catch (e) { setStatus("failed"); setError(e instanceof Error ? e.message : String(e)); stop(); }
    }, intervalMs);
  }, [statusPath, intervalMs, stop]);

  return { status, result, error, startPolling };
}
