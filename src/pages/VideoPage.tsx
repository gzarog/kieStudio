import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import type { VideoModel } from "../lib/types";

interface VideoItem { videoUrl: string; prompt: string }

export function VideoPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<VideoModel>("veo-3.1");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState(5);
  const [history, setHistory] = useState<VideoItem[]>([]);
  const lastPrompt = useRef("");
  const { status, result, error, startPolling } = useTaskPoller<{ videoUrl: string }>("/video", 6000);

  useEffect(() => {
    if (status === "success" && result?.videoUrl) {
      setHistory((h) => [{ videoUrl: result.videoUrl, prompt: lastPrompt.current }, ...h]);
    }
  }, [status, result]);

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastPrompt.current = prompt;
    try {
      const { taskId } = await postToWorker<{ taskId: string }>("/video", { prompt, model, resolution, duration });
      startPolling(taskId, { model });
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🎬 Video</h1>
      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder="Drone shot over Santorini at golden hour, cinematic motion…"
        className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />
      <div className="flex items-center gap-3 flex-wrap">
        <select value={model} onChange={(e) => setModel(e.target.value as VideoModel)}
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          <option value="veo-3.1">Veo 3.1</option>
          <option value="kling-3.0">Kling 3.0</option>
          <option value="seedance-2.0">Seedance 2.0</option>
        </select>
        <select value={resolution} onChange={(e) => setResolution(e.target.value)}
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          <option>720p</option><option>1080p</option>
        </select>
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          <option value={5}>5s</option><option value={8}>8s</option><option value={10}>10s</option>
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
              <video controls src={item.videoUrl} className="rounded-2xl border border-edge w-full" />
              {item.prompt && <p className="text-gray-400 text-xs truncate">{item.prompt}</p>}
              <a href={item.videoUrl} download className="text-sky-400 text-xs underline">Download (link expires in 14 days)</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
