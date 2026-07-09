import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import { ModelPicker } from "../components/shared/ModelPicker";
import { FileDrop } from "../components/shared/FileDrop";
import { ExpiryBadge } from "../components/shared/ExpiryBadge";
import { loadHistory, saveHistory } from "../lib/history";
import { uploadFile } from "../lib/upload";
import { defaultModel, imageCapableModels, imageInputFor } from "../lib/types";

type Mode = "t2v" | "i2v";

interface VideoItem { videoUrl: string; prompt: string; createdAt?: number }

export function VideoPage() {
  const [mode, setMode] = useState<Mode>("t2v");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(defaultModel("video"));
  const [i2vModel, setI2vModel] = useState<string>(imageCapableModels("video")[0]?.id ?? "");
  const [resolution, setResolution] = useState("1080p");
  const [duration, setDuration] = useState(5);
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<VideoItem[]>(() => loadHistory<VideoItem>("video"));
  const lastPrompt = useRef("");
  const { status, result, error, startPolling } = useTaskPoller<{ videoUrl: string }>("/video", 6000);

  useEffect(() => {
    if (status === "success" && result?.videoUrl) {
      setHistory((h) => [
        { videoUrl: result.videoUrl, prompt: lastPrompt.current, createdAt: Date.now() },
        ...h,
      ]);
    }
  }, [status, result]);

  // Persist history across sessions (localStorage — BYOK, nothing server-side).
  useEffect(() => saveHistory("video", history), [history]);

  async function handleFile(file: File) {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    setUploading(true);
    try {
      const { fileUrl } = await uploadFile(file);
      setSourceUrl(fileUrl);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setUploading(false);
    }
  }

  const isI2v = mode === "i2v";
  const activeModel = isI2v ? i2vModel : model;
  const canGenerate = prompt.trim() && (!isI2v || !!sourceUrl);

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastPrompt.current = prompt;
    try {
      // i2v models document duration as a string enum ("5" | "10"); t2v keeps
      // the existing numeric field the dedicated/Jobs routes already accept.
      const body = isI2v
        ? {
            prompt,
            model: i2vModel,
            input: { duration: String(duration), ...imageInputFor(i2vModel, sourceUrl) },
          }
        : { prompt, model, resolution, duration };
      const { taskId } = await postToWorker<{ taskId: string }>("/video", body);
      startPolling(taskId, { model: activeModel });
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm font-medium ${
      active ? "bg-sky-600 text-white" : "bg-surface border border-edge text-gray-300"
    }`;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🎬 Video</h1>

      <div className="flex gap-2">
        <button className={tabClass(!isI2v)} onClick={() => setMode("t2v")}>Text to Video</button>
        <button className={tabClass(isI2v)} onClick={() => setMode("i2v")}>Image to Video</button>
      </div>

      {isI2v && (
        <FileDrop onFile={handleFile} previewUrl={sourceUrl} uploading={uploading} />
      )}

      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder={isI2v
          ? "Describe the motion — e.g. the waves start rolling, camera pulls back…"
          : "Drone shot over Santorini at golden hour, cinematic motion…"}
        className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />

      <div className="flex items-center gap-3 flex-wrap">
        {isI2v ? (
          <ModelPicker category="video" requireImage value={i2vModel} onChange={setI2vModel} />
        ) : (
          <>
            <ModelPicker category="video" capability="t2v" value={model} onChange={setModel} />
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}
              className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
              <option>720p</option><option>1080p</option>
            </select>
          </>
        )}
        <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          <option value={5}>5s</option><option value={8}>8s</option><option value={10}>10s</option>
        </select>
        <button onClick={generate} disabled={!canGenerate || status === "pending" || uploading}
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
              <div className="flex items-center gap-2">
                <a href={item.videoUrl} download className="text-sky-400 text-xs underline">Download</a>
                <ExpiryBadge createdAt={item.createdAt} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
