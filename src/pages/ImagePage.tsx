import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import type { ImageModel } from "../lib/types";

const SIZES = ["512x512", "1024x1024", "2048x2048"];

interface ImageItem { imageUrl: string; prompt: string }

export function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("gpt-image-2");
  const [size, setSize] = useState("1024x1024");
  const [history, setHistory] = useState<ImageItem[]>([]);
  const lastPrompt = useRef("");
  const { status, result, error, startPolling } = useTaskPoller<{ imageUrl: string }>("/image");

  // Push each completed generation onto the history list (newest first).
  useEffect(() => {
    if (status === "success" && result?.imageUrl) {
      setHistory((h) => [{ imageUrl: result.imageUrl, prompt: lastPrompt.current }, ...h]);
    }
  }, [status, result]);

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastPrompt.current = prompt;
    try {
      const { taskId } = await postToWorker<{ taskId: string }>("/image", { prompt, model, size });
      startPolling(taskId, { model });
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🖼️ Image</h1>
      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder="Sunset over the Aegean, oil painting, cinematic…"
        className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />
      <div className="flex items-center gap-4">
        <select value={model} onChange={(e) => setModel(e.target.value as ImageModel)}
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          <option value="gpt-image-2">GPT Image 2</option>
          <option value="nano-banana">Nano Banana</option>
        </select>
        <select value={size} onChange={(e) => setSize(e.target.value)}
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          {SIZES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <button onClick={generate} disabled={!prompt.trim() || status === "pending"}
          className="ml-auto px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
          Generate
        </button>
      </div>
      <TaskStatusBadge status={status} error={error} />

      {history.length > 0 && (
        <div className="space-y-4 pt-2">
          {history.map((item, i) => (
            <div key={i} className="space-y-2">
              <img src={item.imageUrl} alt={item.prompt} className="rounded-2xl border border-edge w-full" />
              {item.prompt && <p className="text-gray-400 text-xs truncate">{item.prompt}</p>}
              <a href={item.imageUrl} download className="text-sky-400 text-xs underline">Download (link expires in 14 days)</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
