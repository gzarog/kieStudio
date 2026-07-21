import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import { ModelPicker } from "../components/shared/ModelPicker";
import { MarkdownContent } from "../components/shared/MarkdownContent";
import { defaultModel } from "../lib/types";
import { onNewSession, onDeleteEntry } from "../lib/sessionBus";
import { extractDelta } from "../lib/chatStream";
import type { ChatMessage } from "../lib/types";

const STORE_KEY = "kie.history.chat";

interface Conversation { id: string; title: string; messages: ChatMessage[]; createdAt: number }

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveConversations(convs: Conversation[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(convs.slice(0, 50))); } catch {}
}

function newConv(): Conversation {
  return { id: crypto.randomUUID(), title: "New chat", messages: [], createdAt: Date.now() };
}

export function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string>(() => conversations[0]?.id ?? "");
  const [input, setInput] = useState("");
  const [model, setModel] = useState<string>(defaultModel("chat"));
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const active = conversations.find((c) => c.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { saveConversations(conversations); }, [conversations]);

  const updateActive = useCallback((fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => c.id === activeId ? fn(c) : c));
  }, [activeId]);

  function startNew() {
    abortRef.current?.abort(); abortRef.current = null; setBusy(false);
    const c = newConv();
    setConversations((prev) => [c, ...prev]);
    setActiveId(c.id);
    setInput("");
  }

  function switchTo(id: string) {
    if (id === activeId) return;
    abortRef.current?.abort(); abortRef.current = null; setBusy(false);
    setActiveId(id);
    setInput("");
  }

  function deleteConv(id: string) {
    abortRef.current?.abort(); abortRef.current = null; setBusy(false);
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (id === activeId) setActiveId(next[0]?.id ?? "");
      return next;
    });
  }

  function stop() { abortRef.current?.abort(); abortRef.current = null; setBusy(false); }

  useEffect(() => {
    const unsub1 = onNewSession(() => startNew());
    const unsub2 = onDeleteEntry(() => { if (activeId) deleteConv(activeId); });
    return () => { unsub1(); unsub2(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard", "success", 1500);
    } catch { toast("Couldn't copy", "error"); }
  }

  async function send() {
    if (!input.trim() || busy) return;
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }

    let targetId = activeId;
    if (!targetId || !conversations.find((c) => c.id === targetId)) {
      const c = newConv();
      setConversations((prev) => [c, ...prev]);
      targetId = c.id;
      setActiveId(c.id);
    }

    const userMsg: ChatMessage = { role: "user", content: input };
    const next = [...messages, userMsg];

    setConversations((prev) => prev.map((c) => {
      if (c.id !== targetId) return c;
      const title = c.messages.length === 0 ? input.slice(0, 60) : c.title;
      return { ...c, title, messages: next };
    }));
    setInput(""); setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await streamChat(model, next, controller.signal);
      if (!res.ok || !res.body) throw new Error(await res.text());

      const asstMsg: ChatMessage = { role: "assistant", content: "" };
      setConversations((prev) => prev.map((c) =>
        c.id === targetId ? { ...c, messages: [...next, asstMsg] } : c
      ));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      let buffer = "";

      const flush = (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:") || t.includes("[DONE]")) continue;
          try {
            const j = JSON.parse(t.slice(5));
            const delta = extractDelta(j);
            if (delta) {
              assistant += delta;
              setConversations((prev) => prev.map((c) =>
                c.id === targetId ? { ...c, messages: [...next, { role: "assistant", content: assistant }] } : c
              ));
            }
          } catch {}
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        flush(decoder.decode(value, { stream: true }));
      }
      flush(decoder.decode() + "\n");

      if (!assistant) {
        setConversations((prev) => prev.map((c) =>
          c.id === targetId ? { ...c, messages: [...next, { role: "assistant", content: "⚠️ No response received — the model returned an empty reply." }] } : c
        ));
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setConversations((prev) => prev.map((c) =>
          c.id === targetId ? { ...c, messages: [...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : e}` }] } : c
        ));
      }
    } finally {
      abortRef.current = null; setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-edge">
        <h1 className="text-white font-semibold">💬 Chat</h1>
        <button onClick={startNew} className="text-sky-400 text-xs hover:text-sky-300">+ New</button>
        {messages.length > 0 && (
          <button onClick={() => { if (activeId) deleteConv(activeId); }} className="text-gray-400 hover:text-white text-xs">Clear</button>
        )}
        <div className="ml-auto">
          <ModelPicker category="chat" value={model} onChange={setModel} />
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Conversation list (desktop) */}
        {conversations.length > 0 && (
          <div className="hidden lg:flex w-52 border-r border-edge flex-col overflow-hidden bg-surface/30">
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
              {conversations.map((c) => (
                <div key={c.id}
                  onClick={() => switchTo(c.id)}
                  className={`group flex items-center gap-1 px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    c.id === activeId ? "bg-sky-600/20 text-white" : "text-gray-400 hover:bg-white/5"
                  }`}>
                  <span className="flex-1 truncate">{c.title}</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteConv(c.id); }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-sm leading-none"
                    aria-label="Delete conversation">&times;</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-gray-400 text-sm text-center mt-12">Ask anything — responses stream from the model you pick.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`group max-w-[80%] ${m.role === "user" ? "ml-auto" : ""}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user" ? "bg-sky-600 text-white whitespace-pre-wrap" : "bg-surface border border-edge text-gray-100"
                }`}>
                  {m.role === "assistant"
                    ? (m.content ? <MarkdownContent text={m.content} /> : "…")
                    : (m.content || "…")}
                </div>
                {m.role === "assistant" && m.content && (
                  <button onClick={() => copy(m.content)}
                    className="mt-1 text-gray-400 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Copy message">
                    Copy
                  </button>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="p-4 border-t border-edge flex gap-2">
            <textarea rows={1} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Message…"
              className="flex-1 bg-surface border border-edge text-white rounded-xl px-4 py-2.5 text-sm resize-none outline-none focus:border-sky-500" />
            {busy ? (
              <button onClick={stop}
                className="px-5 bg-surface border border-edge hover:border-red-500 text-red-400 rounded-xl text-sm font-medium">
                Stop
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim()}
                className="px-5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
