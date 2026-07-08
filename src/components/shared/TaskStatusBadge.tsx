import type { TaskStatus } from "../../lib/types";

export function TaskStatusBadge({ status, error }: { status: TaskStatus; error?: string }) {
  if (status === "idle") return null;
  if (status === "pending")
    return (
      <div className="flex items-center gap-2 text-sky-400 text-sm">
        <span className="w-3 h-3 rounded-full bg-sky-400 animate-pulse" />
        Generating… this can take a minute
      </div>
    );
  if (status === "failed")
    return <p className="text-red-400 text-sm">❌ {error || "Generation failed (not charged)"}</p>;
  return <p className="text-emerald-400 text-sm">✅ Done</p>;
}
