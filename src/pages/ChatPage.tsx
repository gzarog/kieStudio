import { useState, useRef, useEffect } from "react";
import { streamChat } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import { requestKey, toast } from "../lib/ui";
import type { ChatMessage, LLMModel } from "../lib/types";

const MODELS: LLMModel[] = ["claude-sonnet-4-6", "gpt-4o", "gemini-2.5-pro"];
const STORE_KEY = "kie_chat_history";

function loadHistory(): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<LLMModel>("claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Persist the conversation so a refresh doesn't wipe it.
  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(messages)); } catch { /* quota */ }
  }, [messages]);

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  function clearChat() {
    stop();
    setMessages([]);
    sessionStorage.removeItem(STORE_KEY);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard", "success", 1500);
    } catch {
      toast("Couldn't copy", "error");
    }
  }

  async function send() {
    if (!input.trim() || busy) return;
    if (!hasApiKey()) { toast("Add your kie.ai API key first.", "error"); requestKey(); return; }

    const next: ChatMessage[] = [...messages, { role: "user", content: input }];
    setMessages(next); setInput(""); setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await streamChat(model, next, controller.signal);
      if (!res.ok || !res.body) throw new Error(await res.text());

      setMessages([...next, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";
      let buffer = "";

      // SSE events can be split across network chunks, so decode with
      // stream:true and only parse whole lines — keep the trailing partial
      // line in `buffer` until its remainder arrives on a later read.
      const flush = (chunk: string) => {
        buffer += chunk;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:") || t.includes("[DONE]")) continue;
          try {
            const j = JSON.parse(t.slice(5));
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistant += delta;
              setMessages([...next, { role: "assistant", content: assistant }]);
            }
          } catch { /* not JSON — skip */ }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        flush(decoder.decode(value, { stream: true }));
      }
      // Handle any bytes/line left buffered when the stream ends.
      flush(decoder.decode() + "\n");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        // User pressed Stop — keep whatever streamed so far.
      } else {
        setMessages([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : e}` }]);
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-edge">
        <h1 className="text-white font-semibold">💬 Chat</h1>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-gray-400 hover:text-white text-xs">Clear</button>
        )}
        <select value={model} onChange={(e) => setModel(e.target.value as LLMModel)}
          className="ml-auto bg-surface border border-edge text-white text-sm rounded-lg px-3 py-1.5">
          {MODELS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-12">Ask anything — responses stream from the model you pick.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`group max-w-[80%] ${m.role === "user" ? "ml-auto" : ""}`}>
            <div className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-sky-600 text-white" : "bg-surface border border-edge text-gray-100"
            }`}>{m.content || "…"}</div>
            {m.role === "assistant" && m.content && (
              <button onClick={() => copy(m.content)}
                className="mt-1 text-gray-400 hover:text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
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
  );
}
