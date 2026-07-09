import { useEffect, useState, useCallback } from "react";
import { loadHistory } from "../../lib/history";
import { emitNewSession, emitDeleteEntry } from "../../lib/sessionBus";

interface SessionEntry {
  label: string;
  createdAt?: number;
}

function chatSessions(): SessionEntry[] {
  try {
    const raw = sessionStorage.getItem("kie_chat_history");
    const msgs = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(msgs) || msgs.length === 0) return [];
    const first = msgs.find((m: { role: string; content: string }) => m.role === "user");
    return [{ label: first?.content?.slice(0, 60) || "Chat session", createdAt: Date.now() }];
  } catch {
    return [];
  }
}

function historyEntries(page: string): SessionEntry[] {
  if (page === "chat") return chatSessions();

  const items = loadHistory<Record<string, unknown>>(page);
  return items.map((item) => {
    const label =
      (item.prompt as string) ||
      (item.text as string) ||
      (item.title as string) ||
      "Untitled";
    const createdAt = item.createdAt as number | undefined;
    return { label: label.slice(0, 80), createdAt };
  });
}

function timeAgo(ts?: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const PAGE_LABELS: Record<string, string> = {
  chat: "Chat Sessions",
  image: "Image History",
  music: "Music History",
  video: "Video History",
  speech: "Speech History",
};

export function SessionSidebar({ page }: { page: string }) {
  const [entries, setEntries] = useState<SessionEntry[]>([]);

  const refresh = useCallback(() => setEntries(historyEntries(page)), [page]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 2000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <aside className="hidden md:flex w-56 bg-surface/40 border-r border-edge flex-col shrink-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
          {PAGE_LABELS[page] ?? "Sessions"}
        </p>
        <button
          onClick={() => { emitNewSession(); refresh(); }}
          className="px-2 py-0.5 rounded-md text-[10px] font-medium text-sky-400 hover:bg-sky-600/20 transition-colors"
          title="New session">
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
        {entries.length === 0 && (
          <p className="text-gray-500 text-xs px-2 py-3">No sessions yet. Generate something to see it here.</p>
        )}
        {entries.map((e, i) => (
          <div key={i}
            className="group flex items-start gap-1 px-3 py-2 rounded-lg text-xs text-gray-300 hover:bg-white/5 cursor-default transition-colors">
            <div className="flex-1 min-w-0">
              <p className="truncate">{e.label}</p>
              {e.createdAt && (
                <p className="text-gray-500 text-[10px] mt-0.5">{timeAgo(e.createdAt)}</p>
              )}
            </div>
            <button
              onClick={(ev) => { ev.stopPropagation(); emitDeleteEntry(i); refresh(); }}
              className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity text-sm leading-none mt-0.5"
              title="Delete">
              &times;
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
