import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import { ModelPicker } from "../components/shared/ModelPicker";
import { FileDrop } from "../components/shared/FileDrop";
import { TrackActions } from "../components/music/TrackActions";
import { ExpiryBadge } from "../components/shared/ExpiryBadge";
import { loadHistory, saveHistory } from "../lib/history";
import { uploadFile } from "../lib/upload";
import { defaultModel, sunoLimits } from "../lib/types";
import { onNewSession, onDeleteEntry } from "../lib/sessionBus";
import type { Track } from "../lib/types";

type Mode = "simple" | "custom" | "cover";
interface LyricVariation { title?: string; text: string }

export function MusicPage() {
  const [mode, setMode] = useState<Mode>("simple");
  const [prompt, setPrompt] = useState(""); // simple prompt · custom lyrics · cover brief
  const [model, setModel] = useState<string>(defaultModel("music"));
  const [instrumental, setInstrumental] = useState(false);

  // Custom-mode fields
  const [style, setStyle] = useState("");
  const [title, setTitle] = useState("");
  const [negativeTags, setNegativeTags] = useState("");
  const [vocalGender, setVocalGender] = useState<"" | "m" | "f">("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [styleWeight, setStyleWeight] = useState(0.5);
  const [weirdnessConstraint, setWeirdnessConstraint] = useState(0.5);
  const [audioWeight, setAudioWeight] = useState(0.5);

  // Cover upload + AI helpers
  const [coverUrl, setCoverUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [lyricsIdea, setLyricsIdea] = useState("");
  const [variations, setVariations] = useState<LyricVariation[]>([]);

  const [history, setHistory] = useState<Track[]>(() => loadHistory<Track>("music"));
  const lastTask = useRef<{ taskId: string; model: string } | null>(null);

  const gen = useTaskPoller<Track[]>("/music");          // simple + custom generate
  const cover = useTaskPoller<Track[]>("/suno/status");  // upload & cover
  const boost = useTaskPoller<string>("/suno/status");   // style boost (async fallback)
  const lyrics = useTaskPoller<LyricVariation[]>("/suno/status"); // lyric writer

  const limits = sunoLimits(model);

  // Prepend each finished batch of tracks to the session history (newest first),
  // tagging each with the generation taskId + model the studio actions need.
  const prepend = (tracks: Track[]) =>
    setHistory((h) => [
      ...tracks.map((t) => ({ ...t, ...lastTask.current, createdAt: Date.now() })),
      ...h,
    ]);

  useEffect(() => {
    if (gen.status === "success" && gen.result?.length) prepend(gen.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gen.status, gen.result]);

  useEffect(() => {
    if (cover.status === "success" && cover.result?.length) prepend(cover.result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cover.status, cover.result]);

  useEffect(() => {
    if (boost.status === "success" && typeof boost.result === "string") setStyle(boost.result);
  }, [boost.status, boost.result]);

  useEffect(() => {
    if (lyrics.status === "success" && lyrics.result?.length) setVariations(lyrics.result);
  }, [lyrics.status, lyrics.result]);

  useEffect(() => saveHistory("music", history), [history]);

  useEffect(() => {
    const unsub1 = onNewSession(() => { setPrompt(""); setStyle(""); setTitle(""); setCoverUrl(""); setVariations([]); });
    const unsub2 = onDeleteEntry((i) => setHistory((h) => { const next = h.filter((_, idx) => idx !== i); saveHistory("music", next); return next; }));
    return () => { unsub1(); unsub2(); };
  }, []);

  async function handleAudio(file: File) {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    setUploading(true);
    try {
      const { fileUrl } = await uploadFile(file, "audio");
      setCoverUrl(fileUrl);
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setUploading(false);
    }
  }

  /** Optional custom params shared by /generate and /generate/upload-cover. */
  function customParams() {
    const p: Record<string, unknown> = { style, title };
    if (!instrumental) p.prompt = prompt;        // prompt carries the exact lyrics
    if (negativeTags.trim()) p.negativeTags = negativeTags.trim();
    if (vocalGender) p.vocalGender = vocalGender;
    if (showAdvanced) Object.assign(p, { styleWeight, weirdnessConstraint, audioWeight });
    return p;
  }

  const overLimit =
    mode === "custom"
      ? style.length > limits.style || title.length > limits.title ||
        (!instrumental && prompt.length > limits.prompt)
      : prompt.length > limits.nonCustomPrompt;

  const canGenerate =
    !overLimit &&
    (mode === "simple"
      ? !!prompt.trim()
      : mode === "custom"
        ? !!style.trim() && !!title.trim() && (instrumental || !!prompt.trim())
        : !!coverUrl && !!prompt.trim());

  const busy = gen.status === "pending" || cover.status === "pending";

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    try {
      if (mode === "cover") {
        const { taskId } = await postToWorker<{ taskId: string }>("/suno/cover", {
          uploadUrl: coverUrl, prompt, model, instrumental, customMode: false,
        });
        lastTask.current = { taskId, model };
        cover.startPolling(taskId, { kind: "cover" });
      } else {
        const body =
          mode === "custom"
            ? { customMode: true, instrumental, model, ...customParams() }
            : { prompt, model, instrumental, customMode: false };
        const { taskId } = await postToWorker<{ taskId: string }>("/music", body);
        lastTask.current = { taskId, model };
        gen.startPolling(taskId);
      }
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  async function boostStyle() {
    if (!style.trim()) return;
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    setBoosting(true);
    try {
      const r = await postToWorker<{ status?: string; result?: string; taskId?: string }>(
        "/suno/boost-style", { content: style }
      );
      if (r.result) setStyle(r.result);
      else if (r.taskId) boost.startPolling(r.taskId, { kind: "boost-style" });
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setBoosting(false);
    }
  }

  async function writeLyrics() {
    const idea = lyricsIdea.trim() || title.trim() || prompt.trim();
    if (!idea) { toast("Describe the song first.", "error"); return; }
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    try {
      const { taskId } = await postToWorker<{ taskId: string }>("/suno/lyrics", { prompt: idea });
      lyrics.startPolling(taskId, { kind: "lyrics" });
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  const useVariation = (v: LyricVariation) => {
    setPrompt(v.text);
    if (!title.trim() && v.title) setTitle(v.title);
    setVariations([]);
  };

  const tab = (m: Mode, label: string) => (
    <button className={tabClass(mode === m)} onClick={() => setMode(m)}>{label}</button>
  );
  const counter = (n: number, max: number) => (
    <span className={`text-[10px] ${n > max ? "text-red-400" : "text-gray-500"}`}>{n}/{max}</span>
  );

  const inputCls = "w-full bg-surface border border-edge text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500";

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🎵 Music</h1>

      <div className="flex gap-2">
        {tab("simple", "Simple")}
        {tab("custom", "Custom")}
        {tab("cover", "Cover")}
      </div>

      {mode === "cover" && (
        <FileDrop
          onFile={handleAudio}
          previewUrl={coverUrl}
          uploading={uploading}
          accept="audio/*"
          label="Drop an audio file here (≤ 8 min), or click to browse"
          previewKind="video"
        />
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-300 text-xs">Title</label>
              {counter(title.length, limits.title)}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="Aegean Nights" aria-label="Title" className={inputCls} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-gray-300 text-xs">Style</label>
              <div className="flex items-center gap-2">
                {counter(style.length, limits.style)}
                <button onClick={boostStyle} disabled={!style.trim() || boosting || boost.status === "pending"}
                  className="px-2 py-0.5 rounded-md bg-black/20 border border-edge text-sky-300 text-[10px] font-medium disabled:opacity-40">
                  {boosting || boost.status === "pending" ? "Boosting…" : "✨ Boost"}
                </button>
              </div>
            </div>
            <input value={style} onChange={(e) => setStyle(e.target.value)}
              placeholder="dark synthwave, driving bass, female vocals" aria-label="Style" className={inputCls} />
          </div>
        </div>
      )}

      {!(mode === "custom" && instrumental) && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-gray-300 text-xs">
              {mode === "custom" ? "Lyrics" : mode === "cover" ? "Describe the cover" : "Prompt"}
            </label>
            {counter(prompt.length, mode === "custom" ? limits.prompt : limits.nonCustomPrompt)}
          </div>
          <textarea rows={mode === "custom" ? 5 : 3} value={prompt} onChange={(e) => setPrompt(e.target.value)}
            aria-label={mode === "custom" ? "Lyrics" : mode === "cover" ? "Cover brief" : "Prompt"}
            placeholder={mode === "custom"
              ? "[Verse]\nYour own lyrics here…"
              : mode === "cover"
                ? "Turn it into an orchestral cinematic version…"
                : "Upbeat Greek summer pop, male vocals, bouzouki riffs…"}
            className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />
          {mode === "custom" && !instrumental && (
            <div className="mt-1.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <input value={lyricsIdea} onChange={(e) => setLyricsIdea(e.target.value)}
                  placeholder="…or describe a song and let AI write the lyrics"
                  aria-label="Lyrics idea"
                  className="flex-1 bg-black/20 border border-edge text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500" />
                <button onClick={writeLyrics} disabled={lyrics.status === "pending"}
                  className="px-3 py-1.5 bg-black/20 border border-edge text-sky-300 rounded-lg text-xs font-medium disabled:opacity-40 whitespace-nowrap">
                  {lyrics.status === "pending" ? "Writing…" : "Write lyrics"}
                </button>
              </div>
              {variations.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {variations.map((v, i) => (
                    <button key={i} onClick={() => useVariation(v)}
                      className="px-2.5 py-1 rounded-lg bg-black/20 border border-edge text-gray-300 text-xs hover:border-sky-500">
                      Use “{v.title || `Variation ${i + 1}`}”
                    </button>
                  ))}
                </div>
              )}
              {lyrics.status === "failed" && <p className="text-red-400 text-xs">{lyrics.error}</p>}
            </div>
          )}
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <input value={negativeTags} onChange={(e) => setNegativeTags(e.target.value)}
              placeholder="Exclude styles (e.g. acoustic, lo-fi)"
              aria-label="Negative tags"
              className="flex-1 min-w-[12rem] bg-surface border border-edge text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-sky-500" />
            <select value={vocalGender} onChange={(e) => setVocalGender(e.target.value as typeof vocalGender)}
              aria-label="Vocal gender"
              className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
              <option value="">Any voice</option>
              <option value="m">Male</option>
              <option value="f">Female</option>
            </select>
          </div>
          <button onClick={() => setShowAdvanced((s) => !s)} className="text-sky-400 text-xs">
            {showAdvanced ? "▾ Hide advanced" : "▸ Advanced (style / weirdness / audio weight)"}
          </button>
          {showAdvanced && (
            <div className="space-y-2 bg-black/20 border border-edge rounded-lg p-3">
              {([
                ["Style weight", styleWeight, setStyleWeight],
                ["Weirdness", weirdnessConstraint, setWeirdnessConstraint],
                ["Audio weight", audioWeight, setAudioWeight],
              ] as const).map(([label, val, set]) => (
                <label key={label} className="flex items-center gap-3 text-gray-300 text-xs">
                  <span className="w-28">{label}</span>
                  <input type="range" min={0} max={1} step={0.05} value={val}
                    aria-label={label}
                    onChange={(e) => set(Number(e.target.value))} className="flex-1" />
                  <span className="w-8 text-right tabular-nums">{val.toFixed(2)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4">
        <ModelPicker category="music" value={model} onChange={setModel} />
        <label className="flex items-center gap-2 text-gray-300 text-sm">
          <input type="checkbox" checked={instrumental} onChange={(e) => setInstrumental(e.target.checked)} />
          Instrumental
        </label>
        <button onClick={generate} disabled={!canGenerate || busy || uploading}
          className="ml-auto px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
          {mode === "cover" ? "Cover" : "Generate"}
        </button>
      </div>
      <TaskStatusBadge status={mode === "cover" ? cover.status : gen.status}
        error={mode === "cover" ? cover.error : gen.error} />

      {history.map((t) => (
        <div key={t.id} className="bg-surface border border-edge rounded-2xl p-4 flex gap-4">
          <img src={t.imageUrl} alt={t.title} className="w-20 h-20 rounded-xl object-cover" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <p className="text-white font-medium truncate">{t.title}</p>
            <p className="text-gray-400 text-xs truncate">{t.tags}</p>
            <audio controls src={t.audioUrl} className="w-full h-9" />
            <div className="flex items-center gap-2">
              <a href={t.audioUrl} download className="text-sky-400 text-xs underline">Download MP3</a>
              <ExpiryBadge createdAt={t.createdAt} mediaUrl={t.audioUrl} />
            </div>
            <TrackActions track={t} onExtended={(tracks) => setHistory((h) => [...tracks.map((x) => ({ ...x, createdAt: Date.now() })), ...h])} />
          </div>
        </div>
      ))}
    </div>
  );
}

const tabClass = (active: boolean) =>
  `px-4 py-1.5 rounded-lg text-sm font-medium ${
    active ? "bg-sky-600 text-white" : "bg-surface border border-edge text-gray-300"
  }`;
