import { useState, useEffect } from "react";
import { subscribeQueue, clearCompleted, type QueuedTask } from "../../lib/taskQueue";

export function TaskQueueIndicator() {
  const [tasks, setTasks] = useState<QueuedTask[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeQueue(setTasks), []);

  const pending = tasks.filter((t) => t.status === "pending").length;
  const done = tasks.filter((t) => t.status !== "pending").length;

  if (tasks.length === 0) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-xs font-medium whitespace-nowrap"
        aria-label="Task queue">
        {pending > 0 && <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse mr-1" />}
        {pending > 0 ? `${pending} running` : `${done} done`}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-surface border border-edge rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
          <div className="px-3 py-2 border-b border-edge flex justify-between items-center">
            <span className="text-gray-400 text-[10px] uppercase tracking-wider">Jobs</span>
            {done > 0 && (
              <button onClick={clearCompleted} className="text-sky-400 text-[10px]">Clear done</button>
            )}
          </div>
          {tasks.map((t) => (
            <div key={t.taskId} className="px-3 py-2 text-xs border-b border-edge last:border-0">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  t.status === "pending" ? "bg-sky-400 animate-pulse"
                  : t.status === "success" ? "bg-emerald-400" : "bg-red-400"
                }`} />
                <span className="text-white truncate flex-1">{t.prompt || t.model}</span>
                <span className="text-gray-500 shrink-0">{t.page}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
