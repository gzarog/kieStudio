import { useState } from "react";
import { postToWorker } from "../lib/kieClient";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import type { ImageModel } from "../lib/types";

const SIZES = ["512x512", "1024x1024", "2048x2048"];

export function ImagePage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<ImageModel>("gpt-image-2");
  const [size, setSize] = useState("1024x1024");
  const { status, result, error, startPolling } = useTaskPoller<{ imageUrl: string }>("/image");

  async function generate() {
    try {
      const { taskId } = await postToWorker<{ taskId: string }>("/image", { prompt, model, size });
      startPolling(taskId);
    } catch (e) { alert(String(e)); }
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
      {result?.imageUrl && (
        <div className="space-y-2">
          <img src={result.imageUrl} alt={prompt} className="rounded-2xl border border-edge w-full" />
          <a href={result.imageUrl} download className="text-sky-400 text-xs underline">Download (link expires in 14 days)</a>
        </div>
      )}
    </div>
  );
}
