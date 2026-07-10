import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import { ModelPicker } from "../components/shared/ModelPicker";
import { ExpiryBadge } from "../components/shared/ExpiryBadge";
import { loadHistory, saveHistory } from "../lib/history";
import { defaultModel } from "../lib/types";
import { onNewSession, onDeleteEntry } from "../lib/sessionBus";

// Verified per-model defaults: Turbo 2.5 documents a voice ID default (James),
// Multilingual V2's example uses a preset name. Both accept either form.
// Dialogue V3 requires a voice on every line — default it to the James id too.
const VOICE_DEFAULTS: Record<string, string> = {
  "elevenlabs/text-to-speech-turbo-2-5": "EkK5I93UQWFDigLMpZcX",
  "elevenlabs/text-to-speech-multilingual-v2": "Rachel",
  "elevenlabs/text-to-dialogue-v3": "EkK5I93UQWFDigLMpZcX",
};

// Dialogue V3 wraps the text in a `dialogue: [{ text, voice }]` array (verified
// per doc); the flat TTS models take `{ text, speed, voice? }`. Build the right
// `input` fragment per model.
const DIALOGUE_MODEL = "elevenlabs/text-to-dialogue-v3";
export function speechInputFor(
  model: string,
  { text, voice, speed }: { text: string; voice: string; speed: number }
): Record<string, unknown> {
  const v = voice.trim();
  if (model === DIALOGUE_MODEL) {
    return { dialogue: [{ text, voice: v || VOICE_DEFAULTS[DIALOGUE_MODEL] }] };
  }
  const input: Record<string, unknown> = { text, speed };
  if (v) input.voice = v;
  return input;
}

const SPEEDS = [0.8, 0.9, 1, 1.1, 1.2];

interface SpeechItem { audioUrl: string; text: string; createdAt?: number }

export function SpeechPage() {
  const [text, setText] = useState("");
  const [model, setModel] = useState<string>(defaultModel("speech"));
  const [voice, setVoice] = useState<string>(VOICE_DEFAULTS[defaultModel("speech")] ?? "");
  const [speed, setSpeed] = useState(1);
  const [history, setHistory] = useState<SpeechItem[]>(() => loadHistory<SpeechItem>("speech"));
  const lastText = useRef("");
  const { status, result, error, startPolling } = useTaskPoller<{ resultUrls: string[] }>("/jobs/status");

  useEffect(() => {
    if (status === "success" && result?.resultUrls?.[0]) {
      setHistory((h) => [
        { audioUrl: result.resultUrls[0], text: lastText.current, createdAt: Date.now() },
        ...h,
      ]);
    }
  }, [status, result]);

  useEffect(() => saveHistory("speech", history), [history]);

  useEffect(() => {
    const unsub1 = onNewSession(() => setText(""));
    const unsub2 = onDeleteEntry((i) => setHistory((h) => { const next = h.filter((_, idx) => idx !== i); saveHistory("speech", next); return next; }));
    return () => { unsub1(); unsub2(); };
  }, []);

  function pickModel(id: string) {
    setModel(id);
    setVoice(VOICE_DEFAULTS[id] ?? "");
  }

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastText.current = text;
    try {
      const input = speechInputFor(model, { text, voice, speed });
      const { taskId } = await postToWorker<{ taskId: string }>("/jobs/submit", { model, input });
      startPolling(taskId);
    } catch (e) { toast(e instanceof Error ? e.message : String(e), "error"); }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-white text-xl font-semibold">🗣️ Speech</h1>
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)}
        placeholder="Type the text to speak — up to 5000 characters…"
        className="w-full bg-surface border border-edge text-white rounded-xl p-3 text-sm font-mono outline-none focus:border-sky-500" />
      <div className="flex items-center gap-3 flex-wrap">
        <ModelPicker category="speech" value={model} onChange={pickModel} />
        <input value={voice} onChange={(e) => setVoice(e.target.value)}
          placeholder="Voice (name or ID)" aria-label="Voice"
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2 w-44 outline-none focus:border-sky-500" />
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed"
          className="bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2">
          {SPEEDS.map((s) => <option key={s} value={s}>{s}×</option>)}
        </select>
        <button onClick={generate} disabled={!text.trim() || status === "pending"}
          className="ml-auto px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
          Generate
        </button>
      </div>
      <TaskStatusBadge status={status} error={error} />

      {history.map((item, i) => (
        <div key={i} className="bg-surface border border-edge rounded-2xl p-4 space-y-2">
          <p className="text-gray-400 text-xs truncate">{item.text}</p>
          <audio controls src={item.audioUrl} className="w-full h-9" />
          <div className="flex items-center gap-2">
            <a href={item.audioUrl} download className="text-sky-400 text-xs underline">Download audio</a>
            <ExpiryBadge createdAt={item.createdAt} />
          </div>
        </div>
      ))}
    </div>
  );
}
