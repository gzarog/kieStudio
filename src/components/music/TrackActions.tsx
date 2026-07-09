import { useState, useEffect, useRef } from "react";
import { postToWorker } from "../../lib/kieClient";
import { toast } from "../../lib/ui";
import { useTaskPoller } from "../../hooks/useTaskPoller";
import type { Track } from "../../lib/types";

// Owner's workflow: Suno → stems → Reaper → DistroKid. Priority actions on every
// track card: Extend, stem separation, WAV master, timestamped lyrics.

type Panel = "extend" | "stems" | "wav" | "lyrics" | null;

/** Human labels for the stem URL fields the vocal-removal endpoint can return. */
const STEM_LABELS: Record<string, string> = {
  vocalUrl: "Vocals",
  instrumentalUrl: "Instrumental",
  backingVocalsUrl: "Backing vocals",
  drumsUrl: "Drums",
  bassUrl: "Bass",
  guitarUrl: "Guitar",
  pianoUrl: "Piano",
  keyboardUrl: "Keyboard",
  percussionUrl: "Percussion",
  stringsUrl: "Strings",
  synthUrl: "Synth",
  fxUrl: "FX",
  brassUrl: "Brass",
  woodwindsUrl: "Woodwinds",
};

interface AlignedWord { word: string; startS: number; endS: number }

interface TrackActionsProps {
  track: Track;
  /** Called with the new tracks when an Extend completes. */
  onExtended?: (tracks: Track[]) => void;
}

export function TrackActions({ track, onExtended }: TrackActionsProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [extendPrompt, setExtendPrompt] = useState("");
  const [stemType, setStemType] = useState<"separate_vocal" | "split_stem">("separate_vocal");
  const [lyrics, setLyrics] = useState<AlignedWord[] | null>(null);
  const [lyricsBusy, setLyricsBusy] = useState(false);

  const extend = useTaskPoller<Track[]>("/suno/status");
  const stems = useTaskPoller<Record<string, string>>("/suno/status");
  const wav = useTaskPoller<{ audioWavUrl?: string }>("/suno/status");
  const extendTaskId = useRef("");

  useEffect(() => {
    if (extend.status === "success" && extend.result?.length) {
      // Tag results with the extend taskId + source model so the new cards'
      // own actions (stems / WAV / lyrics / further extends) keep working.
      onExtended?.(
        extend.result.map((t) => ({ ...t, taskId: extendTaskId.current, model: track.model }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extend.status, extend.result]);

  async function run(fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    }
  }

  const startExtend = () =>
    run(async () => {
      const { taskId } = await postToWorker<{ taskId: string }>("/suno/extend", {
        audioId: track.id,
        prompt: extendPrompt,
        model: track.model,
      });
      extendTaskId.current = taskId;
      extend.startPolling(taskId, { kind: "extend" });
    });

  const startStems = () =>
    run(async () => {
      const { taskId } = await postToWorker<{ taskId: string }>("/suno/stems", {
        taskId: track.taskId,
        audioId: track.id,
        type: stemType,
      });
      stems.startPolling(taskId, { kind: "stems" });
    });

  const startWav = () =>
    run(async () => {
      const { taskId } = await postToWorker<{ taskId: string }>("/suno/wav", {
        taskId: track.taskId,
        audioId: track.id,
      });
      wav.startPolling(taskId, { kind: "wav" });
    });

  const fetchLyrics = () =>
    run(async () => {
      setLyricsBusy(true);
      try {
        const { alignedWords } = await postToWorker<{ alignedWords: AlignedWord[] }>(
          "/suno/timestamped-lyrics",
          { taskId: track.taskId, audioId: track.id }
        );
        setLyrics(alignedWords);
      } finally {
        setLyricsBusy(false);
      }
    });

  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-lg text-xs font-medium ${
      active ? "bg-sky-600 text-white" : "bg-black/20 border border-edge text-gray-300"
    }`;
  const busyText = (s: string) => (s === "pending" ? "Working…" : null);

  return (
    <div className="space-y-2" data-testid="track-actions">
      <div className="flex flex-wrap gap-1.5">
        <button className={chip(panel === "extend")} onClick={() => toggle("extend")}>Extend</button>
        <button className={chip(panel === "stems")} onClick={() => toggle("stems")}>Stems</button>
        <button className={chip(panel === "wav")} onClick={() => toggle("wav")}>WAV</button>
        <button className={chip(panel === "lyrics")} onClick={() => toggle("lyrics")}>Lyrics</button>
      </div>

      {panel === "extend" && (
        <div className="space-y-2">
          <input
            value={extendPrompt}
            onChange={(e) => setExtendPrompt(e.target.value)}
            placeholder="Describe how the track should continue…"
            aria-label="Extension prompt"
            className="w-full bg-black/20 border border-edge text-white rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
          />
          <button
            onClick={startExtend}
            disabled={!extendPrompt.trim() || extend.status === "pending"}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium"
          >
            {busyText(extend.status) ?? "Extend track"}
          </button>
          {extend.status === "failed" && <p className="text-red-400 text-xs">{extend.error}</p>}
          {extend.status === "success" && (
            <p className="text-emerald-400 text-xs">Extension added to the list above.</p>
          )}
        </div>
      )}

      {panel === "stems" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <select
              value={stemType}
              onChange={(e) => setStemType(e.target.value as typeof stemType)}
              aria-label="Stem mode"
              className="bg-black/20 border border-edge text-white text-xs rounded-lg px-2 py-1.5"
            >
              <option value="separate_vocal">Vocals + instrumental</option>
              <option value="split_stem">Full stem split</option>
            </select>
            <button
              onClick={startStems}
              disabled={stems.status === "pending"}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium"
            >
              {busyText(stems.status) ?? "Separate"}
            </button>
          </div>
          {stems.status === "failed" && <p className="text-red-400 text-xs">{stems.error}</p>}
          {stems.status === "success" && stems.result && (
            <ul className="space-y-1">
              {Object.entries(stems.result)
                .filter(([k, v]) => k.endsWith("Url") && v)
                .map(([k, url]) => (
                  <li key={k}>
                    <a href={url} download className="text-sky-400 text-xs underline">
                      Download {STEM_LABELS[k] ?? k} (expires in 14 days)
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {panel === "wav" && (
        <div className="space-y-2">
          <button
            onClick={startWav}
            disabled={wav.status === "pending"}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium"
          >
            {busyText(wav.status) ?? "Convert to WAV"}
          </button>
          {wav.status === "failed" && <p className="text-red-400 text-xs">{wav.error}</p>}
          {wav.status === "success" && wav.result?.audioWavUrl && (
            <a href={wav.result.audioWavUrl} download className="text-sky-400 text-xs underline">
              Download WAV master (expires in 14 days)
            </a>
          )}
        </div>
      )}

      {panel === "lyrics" && (
        <div className="space-y-2">
          <button
            onClick={fetchLyrics}
            disabled={lyricsBusy}
            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium"
          >
            {lyricsBusy ? "Fetching…" : "Get timestamped lyrics"}
          </button>
          {lyrics && lyrics.length === 0 && (
            <p className="text-gray-400 text-xs">No lyrics available for this track.</p>
          )}
          {lyrics && lyrics.length > 0 && (
            <pre className="bg-black/20 border border-edge rounded-lg p-2 text-gray-300 text-xs max-h-48 overflow-auto whitespace-pre-wrap">
              {lyrics.map((w) => `[${w.startS.toFixed(2)}s] ${w.word}`).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
