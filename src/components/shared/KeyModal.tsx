import { useState } from "react";
import { getApiKey, setApiKey, clearApiKey } from "../../lib/apiKey";

export function KeyModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(getApiKey());

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-edge rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-white text-lg font-semibold">🔑 Your kie.ai API key</h2>
        <p className="text-gray-400 text-sm">
          Stored only in your browser — never on our servers. Get a free key with 80 trial credits at{" "}
          <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" className="text-sky-400 underline">kie.ai/api-key</a>.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your key…"
          className="w-full bg-base border border-edge text-white rounded-lg px-3 py-2 font-mono text-sm outline-none focus:border-sky-500"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => { clearApiKey(); setKey(""); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Clear</button>
          <button
            onClick={() => { setApiKey(key); onClose(); }}
            disabled={!key.trim()}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
          >Save key</button>
        </div>
      </div>
    </div>
  );
}
