import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import { ModelPicker } from "../components/shared/ModelPicker";
import { FileDrop } from "../components/shared/FileDrop";
import { ExpiryBadge } from "../components/shared/ExpiryBadge";
import { PromptBox, recordPrompt } from "../components/shared/PromptBox";
import { loadHistory, saveHistory } from "../lib/history";
import { uploadFile } from "../lib/upload";
import { defaultModel, imageCapableModels, imageInputFor, catalogModel } from "../lib/types";
import { onNewSession, onDeleteEntry } from "../lib/sessionBus";
import { setHandoff, consumeHandoff } from "../lib/handoff";
import { exportHistory, importHistory, downloadAll } from "../lib/historyExport";
import { useNavigate } from "react-router-dom";

const SIZES = ["512x512", "1024x1024", "2048x2048"];

type Mode = "create" | "edit";

interface ImageItem { imageUrl: string; prompt: string; createdAt?: number }

export function ImagePage() {
  const [mode, setMode] = useState<Mode>("create");
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(defaultModel("image"));
  const [editModel, setEditModel] = useState<string>(imageCapableModels("image")[0]?.id ?? "");
  const [size, setSize] = useState("1024x1024");
  const [sourceUrl, setSourceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [history, setHistory] = useState<ImageItem[]>(() => loadHistory<ImageItem>("image"));
  const lastPrompt = useRef("");
  const navigate = useNavigate();
  const { status, result, error, startPolling } = useTaskPoller<{ imageUrl: string }>("/image");

  // Accept a handoff from another page (e.g. "Edit this image" from Video)
  useEffect(() => {
    const h = consumeHandoff();
    if (h?.kind === "image") { setSourceUrl(h.mediaUrl); setMode("edit"); }
  }, []);

  // Push each completed generation onto the history list (newest first).
  useEffect(() => {
    if (status === "success" && result?.imageUrl) {
      setHistory((h) => [
        { imageUrl: result.imageUrl, prompt: lastPrompt.current, createdAt: Date.now() },
        ...h,
      ]);
    }
  }, [status, result]);

  useEffect(() => saveHistory("image", history), [history]);

  useEffect(() => {
    const unsub1 = onNewSession(() => { setPrompt(""); setSourceUrl(""); });
    const unsub2 = onDeleteEntry((i) => setHistory((h) => { const next = h.filter((_, idx) => idx !== i); saveHistory("image", next); return next; }));
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

  const isEdit = mode === "edit";
  const activeModel = isEdit ? editModel : model;
  const promptOptional = isEdit && !!catalogModel(editModel)?.promptOptional;
  const canGenerate = isEdit
    ? !!sourceUrl && (promptOptional || !!prompt.trim())
    : !!prompt.trim();

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastPrompt.current = prompt;
    recordPrompt("image", prompt);
    try {
      const body = isEdit
        ? { prompt, model: editModel, input: imageInputFor(editModel, sourceUrl) }
        : { prompt, model, size };
      const { taskId } = await postToWorker<{ taskId: string }>("/image", body);
      startPolling(taskId, { model: activeModel });
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm font-medium ${
      active ? "bg-sky-600 text-white" : "bg-surface border border-edge text-gray-300"
    }`;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🖼️ Image</h1>

      <div className="flex gap-2">
        <button className={tabClass(!isEdit)} onClick={() => setMode("create")}>Create</button>
        <button className={tabClass(isEdit)} onClick={() => setMode("edit")}>Edit / Remix</button>
      </div>

      {isEdit && (
        <FileDrop onFile={handleFile} previewUrl={sourceUrl} uploading={uploading} />
      )}

      <PromptBox category="image" value={prompt} onChange={setPrompt}
        placeholder={isEdit
          ? "Describe the edit — e.g. replace the sky with a thunderstorm…"
          : "Sunset over the Aegean, oil painting, cinematic…"} />

      <div className="flex items-center gap-4">
        {isEdit ? (
          <ModelPicker category="image" requireImage value={editModel} onChange={setEditModel} />
        ) : (
          <>
            <ModelPicker category="image" capability="t2i" value={model} onChange={setModel} />
            <select value={size} onChange={(e) => setSize(e.target.value)}
              className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
              {SIZES.map((s) => <option key={s}>{s}</option>)}
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
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => downloadAll(history.map((h) => h.imageUrl), "image")} className="text-sky-400 hover:text-sky-300">Download all</button>
            <button onClick={() => exportHistory("image")} className="text-gray-400 hover:text-white">Export</button>
            <label className="text-gray-400 hover:text-white cursor-pointer">
              Import
              <input type="file" accept=".json" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importHistory("image", f, () => setHistory(loadHistory("image")));
                e.target.value = "";
              }} />
            </label>
          </div>
          {history.map((item, i) => (
            <div key={i} className="space-y-2">
              <img src={item.imageUrl} alt={item.prompt} className="rounded-2xl border border-edge w-full" />
              {item.prompt && <p className="text-gray-400 text-xs truncate">{item.prompt}</p>}
              <div className="flex items-center gap-2 flex-wrap">
                <a href={item.imageUrl} download className="text-sky-400 text-xs underline">Download</a>
                <button onClick={() => { setSourceUrl(item.imageUrl); setMode("edit"); window.scrollTo(0, 0); }}
                  className="text-sky-400 text-xs underline">Edit</button>
                <button onClick={() => { setHandoff({ mediaUrl: item.imageUrl, kind: "image" }); navigate("/video"); }}
                  className="text-sky-400 text-xs underline">Use in Video</button>
                <ExpiryBadge createdAt={item.createdAt} mediaUrl={item.imageUrl} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
