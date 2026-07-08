import { useState, useRef, useEffect } from "react";
import { streamChat } from "../lib/kieClient";
import { hasApiKey } from "../lib/apiKey";
import type { ChatMessage, LLMModel } from "../lib/types";

const MODELS: LLMModel[] = ["claude-sonnet-4-6", "gpt-4o", "gemini-2.5-pro"];

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState<LLMModel>("claude-sonnet-4-6");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!input.trim() || busy) return;
    if (!hasApiKey()) { alert("Add your kie.ai API key first (⚙️ top right)."); return; }

    const next: ChatMessage[] = [...messages, { role: "user", content: input }];
    setMessages(next); setInput(""); setBusy(true);

    try {
      const res = await streamChat(model, next);
      if (!res.ok || !res.body) throw new Error(await res.text());

      setMessages([...next, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistant = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          const t = line.trim();
          if (!t.startsWith("data:") || t.includes("[DONE]")) continue;
          try {
            const j = JSON.parse(t.slice(5));
            const delta = j.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistant += delta;
              setMessages([...next, { role: "assistant", content: assistant }]);
            }
          } catch { /* partial chunk */ }
        }
      }
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ ${e}` }]);
    } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-4 border-b border-edge">
        <h1 className="text-white font-semibold">💬 Chat</h1>
        <select value={model} onChange={(e) => setModel(e.target.value as LLMModel)}
          className="ml-auto bg-surface border border-edge text-white text-sm rounded-lg px-3 py-1.5">
          {MODELS.map((m) => <option key={m}>{m}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-12">Ask anything — responses stream from the model you pick.</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
            m.role === "user" ? "ml-auto bg-sky-600 text-white" : "bg-surface border border-edge text-gray-100"
          }`}>{m.content || "…"}</div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-edge flex gap-2">
        <textarea rows={1} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message…"
          className="flex-1 bg-surface border border-edge text-white rounded-xl px-4 py-2.5 text-sm resize-none outline-none focus:border-sky-500" />
        <button onClick={send} disabled={busy || !input.trim()}
          className="px-5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium">
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
