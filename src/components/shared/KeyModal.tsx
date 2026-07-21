import { useState, useEffect } from "react";
import { getApiKey, setApiKey, clearApiKey } from "../../lib/apiKey";
import { validateKey } from "../../lib/kieClient";
import { toast } from "../../lib/ui";
import { setCredits } from "../../lib/credits";

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "ok"; credits?: number }
  | { state: "bad" };

export function KeyModal({ onClose }: { onClose: () => void }) {
  const [key, setKey] = useState(getApiKey());
  const [check, setCheck] = useState<Check>({ state: "idle" });

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  async function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    setApiKey(trimmed);
    setCheck({ state: "checking" });
    const { valid, credits } = await validateKey();
    if (valid) {
      setCheck({ state: "ok", credits });
      if (typeof credits === "number") setCredits(credits); // header badge

      toast(
        credits !== undefined ? `Key saved — ${credits} credits remaining` : "Key saved & verified",
        "success"
      );
      setTimeout(onClose, 700);
    } else {
      setCheck({ state: "bad" });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="API key settings">
      <div className="bg-surface border border-edge rounded-2xl p-6 w-full max-w-md space-y-4">
        <h2 className="text-white text-lg font-semibold">🔑 Your kie.ai API key</h2>
        <p className="text-gray-400 text-sm">
          Stored only in your browser — never on our servers. Get a free key with 80 trial credits at{" "}
          <a href="https://kie.ai/api-key" target="_blank" rel="noreferrer" className="text-sky-400 underline">kie.ai/api-key</a>.
        </p>
        <input
          type="password"
          value={key}
          onChange={(e) => { setKey(e.target.value); setCheck({ state: "idle" }); }}
          onKeyDown={(e) => { if (e.key === "Enter") save(); }}
          placeholder="Paste your key…"
          className="w-full bg-base border border-edge text-white rounded-lg px-3 py-2 font-mono text-sm outline-none focus:border-sky-500"
        />

        {check.state === "ok" && (
          <p className="text-emerald-400 text-sm">
            ✓ Verified{check.credits !== undefined ? ` — ${check.credits} credits remaining` : ""}
          </p>
        )}
        {check.state === "bad" && (
          <p className="text-red-400 text-sm">✗ Key rejected by kie.ai. Double-check and try again.</p>
        )}

        <div className="flex gap-2 justify-end items-center">
          <button
            onClick={() => { clearApiKey(); setKey(""); setCheck({ state: "idle" }); }}
            className="px-4 py-2 text-gray-400 hover:text-white text-sm"
          >Clear</button>
          <button
            onClick={save}
            disabled={!key.trim() || check.state === "checking"}
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-sm font-medium"
          >{check.state === "checking" ? "Verifying…" : "Save key"}</button>
        </div>
      </div>
    </div>
  );
}
