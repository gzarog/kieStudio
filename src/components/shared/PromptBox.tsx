import { useState, useRef, useEffect } from "react";
import { getSavedPrompts, getRecentPrompts, savePrompt, removeSavedPrompt, recordPrompt } from "../../lib/promptLibrary";

interface Props {
  category: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  label?: string;
}

export function PromptBox({ category, value, onChange, placeholder, rows = 3, label }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const saved = getSavedPrompts(category);
  const recent = getRecentPrompts(category);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function pick(text: string) { onChange(text); setOpen(false); }

  return (
    <div ref={ref} className="relative">
      {label && <label className="text-gray-300 text-xs mb-1 block">{label}</label>}
      <div className="relative">
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={label ?? "Prompt"}
          className="w-full bg-surface border border-edge text-white rounded-xl p-3 pr-20 text-sm font-mono outline-none focus:border-sky-500" />
        <div className="absolute top-2 right-2 flex gap-1">
          {value.trim() && (
            <button onClick={() => { savePrompt(category, value.trim()); }}
              className="px-1.5 py-0.5 rounded text-[10px] text-sky-400 hover:bg-sky-600/20" title="Save prompt">
              ★
            </button>
          )}
          <button onClick={() => setOpen(!open)}
            className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:bg-white/10" title="Prompt library">
            📋
          </button>
        </div>
      </div>
      {open && (saved.length > 0 || recent.length > 0) && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-surface border border-edge rounded-xl shadow-xl max-h-64 overflow-y-auto">
          {saved.length > 0 && (
            <div className="px-3 py-2">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Saved</p>
              {saved.map((p, i) => (
                <div key={i} className="group flex items-center gap-1 py-1 text-xs text-gray-300 hover:text-white cursor-pointer">
                  <span className="flex-1 truncate" onClick={() => pick(p.text)}>{p.text}</span>
                  <button onClick={() => removeSavedPrompt(category, p.text)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 text-sm">&times;</button>
                </div>
              ))}
            </div>
          )}
          {recent.length > 0 && (
            <div className="px-3 py-2 border-t border-edge">
              <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-1">Recent</p>
              {recent.map((text, i) => (
                <div key={i} className="py-1 text-xs text-gray-300 hover:text-white cursor-pointer truncate"
                  onClick={() => pick(text)}>{text}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { recordPrompt };
