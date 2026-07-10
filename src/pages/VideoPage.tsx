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
import { defaultModel, imageCapableModels, imageInputFor, videoCapableModels, videoInputFor, catalogModel } from "../lib/types";
import { onNewSession, onDeleteEntry } from "../lib/sessionBus";

type Mode = "t2v" | "i2v" | "v2v";

interface VideoItem { videoUrl: string; prompt: string; createdAt?: number }

export function VideoPage() {
  const [mode, setMode] = useState<Mode>("t2v");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(defaultModel("video"));
  const [i2vModel, setI2vModel] = useState<string>(imageCapableModels("video")[0]?.id ?? "");
  const [v2vModel, setV2vModel] = useState<string>(videoCapableModels("video")[0]?.id ?? "");
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

  useEffect(() => saveHistory("video", history), [history]);

  useEffect(() => {
    const unsub1 = onNewSession(() => { setPrompt(""); setSourceUrl(""); });
    const unsub2 = onDeleteEntry((i) => setHistory((h) => { const next = h.filter((_, idx) => idx !== i); saveHistory("video", next); return next; }));
    return () => { unsub1(); unsub2(); };
  }, []);

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
  const isV2v = mode === "v2v";
  const needsUpload = isI2v || isV2v;
  const activeModel = isV2v ? v2vModel : isI2v ? i2vModel : model;
  // Some v2v models (video edit / upscale) run without a text prompt.
  const promptOptional = isV2v && !!catalogModel(v2vModel)?.promptOptional;
  const canGenerate = needsUpload
    ? !!sourceUrl && (promptOptional || !!prompt.trim())
    : !!prompt.trim();

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastPrompt.current = prompt;
    try {
      // i2v models document duration as a string enum ("5" | "10"); t2v keeps
      // the existing numeric field the dedicated/Jobs routes already accept.
      // v2v carries only the source video URL (per-model field) plus the prompt.
      const body = isV2v
        ? { prompt, model: v2vModel, input: videoInputFor(v2vModel, sourceUrl) }
        : isI2v
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
        <button className={tabClass(mode === "t2v")} onClick={() => { setMode("t2v"); setSourceUrl(""); }}>Text to Video</button>
        <button className={tabClass(isI2v)} onClick={() => { setMode("i2v"); setSourceUrl(""); }}>Image to Video</button>
        <button className={tabClass(isV2v)} onClick={() => { setMode("v2v"); setSourceUrl(""); }}>Video to Video</button>
      </div>

      {needsUpload && (
        <FileDrop
          onFile={handleFile}
          previewUrl={sourceUrl}
          uploading={uploading}
          accept={isV2v ? "video/*" : "image/*"}
          previewKind={isV2v ? "video" : "image"}
          label={isV2v ? "Drop a video here, or click to browse" : "Drop an image here, or click to browse"}
        />
      )}

      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder={isV2v
          ? (promptOptional
              ? "Optional — describe the transformation…"
              : "Describe the transformation — e.g. restyle as a watercolour painting…")
          : isI2v
          ? "Describe the motion — e.g. the waves start rolling, camera pulls back…"
          : "Drone shot over Santorini at golden hour, cinematic motion…"}
        className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />

      <div className="flex items-center gap-3 flex-wrap">
        {isV2v ? (
          <ModelPicker category="video" requireVideo value={v2vModel} onChange={setV2vModel} />
        ) : isI2v ? (
          <>
            <ModelPicker category="video" requireImage value={i2vModel} onChange={setI2vModel} />
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
              <option value={5}>5s</option><option value={8}>8s</option><option value={10}>10s</option>
            </select>
          </>
        ) : (
          <>
            <ModelPicker category="video" capability="t2v" value={model} onChange={setModel} />
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}
              className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
              <option>720p</option><option>1080p</option>
            </select>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
              <option value={5}>5s</option><option value={8}>8s</option><option value={10}>10s</option>
            </select>
          </>
        )}
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
