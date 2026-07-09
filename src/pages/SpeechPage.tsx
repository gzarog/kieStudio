import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { useTaskPoller } from "../hooks/useTaskPoller";
import { TaskStatusBadge } from "../components/shared/TaskStatusBadge";
import { ModelPicker } from "../components/shared/ModelPicker";
import { defaultModel } from "../lib/types";

// Verified per-model defaults: Turbo 2.5 documents a voice ID default (James),
// Multilingual V2's example uses a preset name. Both accept either form.
const VOICE_DEFAULTS: Record<string, string> = {
  "elevenlabs/text-to-speech-turbo-2-5": "EkK5I93UQWFDigLMpZcX",
  "elevenlabs/text-to-speech-multilingual-v2": "Rachel",
};

const SPEEDS = [0.8, 0.9, 1, 1.1, 1.2];

interface SpeechItem { audioUrl: string; text: string }

export function SpeechPage() {
  const [text, setText] = useState("");
  const [model, setModel] = useState<string>(defaultModel("speech"));
  const [voice, setVoice] = useState<string>(VOICE_DEFAULTS[defaultModel("speech")] ?? "");
  const [speed, setSpeed] = useState(1);
  const [history, setHistory] = useState<SpeechItem[]>([]);
  const lastText = useRef("");
  const { status, result, error, startPolling } = useTaskPoller<{ resultUrls: string[] }>("/jobs/status");

  useEffect(() => {
    if (status === "success" && result?.resultUrls?.[0]) {
      setHistory((h) => [{ audioUrl: result.resultUrls[0], text: lastText.current }, ...h]);
    }
  }, [status, result]);

  function pickModel(id: string) {
    setModel(id);
    setVoice(VOICE_DEFAULTS[id] ?? "");
  }

  async function generate() {
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }
    lastText.current = text;
    try {
      const input: Record<string, unknown> = { text, speed };
      if (voice.trim()) input.voice = voice.trim();
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
          <a href={item.audioUrl} download className="text-sky-400 text-xs underline">
            Download audio (link expires in 14 days)
          </a>
        </div>
      ))}
    </div>
  );
}
