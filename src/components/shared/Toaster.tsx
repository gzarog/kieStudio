import { useEffect, useState } from "react";
import { subscribeToasts, dismissToast, type Toast } from "../../lib/ui";

const STYLES: Record<Toast["kind"], string> = {
  info: "bg-surface border-edge text-gray-100",
  success: "bg-emerald-600/90 border-emerald-400/40 text-white",
  error: "bg-red-600/90 border-red-400/40 text-white",
};

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismissToast(t.id)}
          className={`text-left text-sm rounded-xl border px-4 py-2.5 shadow-lg backdrop-blur ${STYLES[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
