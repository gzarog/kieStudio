import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import { ModelPicker } from "../components/shared/ModelPicker";
import { TrackActions } from "../components/music/TrackActions";
import { ExpiryBadge } from "../components/shared/ExpiryBadge";
import { loadHistory, saveHistory } from "../lib/history";
import { defaultModel } from "../lib/types";
import { onNewSession, onDeleteEntry } from "../lib/sessionBus";
import type { Track } from "../lib/types";

export function MusicPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState<string>(defaultModel("music"));
  const [instrumental, setInstrumental] = useState(false);
  const [history, setHistory] = useState<Track[]>(() => loadHistory<Track>("music"));
  const lastTask = useRef<{ taskId: string; model: string } | null>(null);
  const { status, result, error, startPolling } = useTaskPoller<Track[]>("/music");

  // Prepend each finished batch of tracks to the session history (newest first),
  // tagging each track with the generation taskId + model the studio actions need.
  useEffect(() => {
    if (status === "success" && result?.length) {
      const tagged = result.map((t) => ({ ...t, ...lastTask.current, createdAt: Date.now() }));
      setHistory((h) => [...tagged, ...h]);
    }
  }, [status, result]);

  useEffect(() => saveHistory("music", history), [history]);

  useEffect(() => {
    const unsub1 = onNewSession(() => setPrompt(""));
    const unsub2 = onDeleteEntry((i) => setHistory((h) => { const next = h.filter((_, idx) => idx !== i); saveHistory("music", next); return next; }));
    return () => { unsub1(); unsub2(); };
  }, []);

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    try {
      const { taskId } = await postToWorker<{ taskId: string }>("/music", { prompt, model, instrumental });
      lastTask.current = { taskId, model };
      startPolling(taskId);
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🎵 Music</h1>
      <textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
        placeholder="Upbeat Greek summer pop, male vocals, bouzouki riffs…"
        className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />
      <div className="flex items-center gap-4">
        <ModelPicker category="music" value={model} onChange={setModel} />
        <label className="flex items-center gap-2 text-gray-300 text-sm">
          <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
          Instrumental
        </label>
        <button onClick={generate} disabled={!prompt.trim() || status === "pending"}
          className="ml-auto px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
          Generate
        </button>
      </div>
      <TaskStatusBadge status={status} error={error} />

      {history.map((t) => (
        <div key={t.id} className="bg-surface border border-edge rounded-2xl p-4 flex gap-4">
          <img src={t.imageUrl} alt={t.title} className="w-20 h-20 rounded-xl object-cover" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-white font-medium truncate">{t.title}</p>
            <p className="text-gray-400 text-xs truncate">{t.tags}</p>
            <audio controls src={t.audioUrl} className="w-full h-9" />
            <div className="flex items-center gap-2">
              <a href={t.audioUrl} download className="text-sky-400 text-xs underline">Download MP3</a>
              <ExpiryBadge createdAt={t.createdAt} />
            </div>
            <TrackActions track={t} onExtended={(tracks) => setHistory((h) => [...tracks.map((x) => ({ ...x, createdAt: Date.now() })), ...h])} />
          </div>
        </div>
      ))}
    </div>
  );
}
