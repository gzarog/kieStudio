// Persistent concurrent task queue: tracks in-flight generation tasks across
// page navigations and reloads. Each page's useTaskPoller still polls its own
// tasks; this store gives a global view for the header indicator.

const STORE_KEY = "kie.taskQueue";

export interface QueuedTask {
  taskId: string;
  page: string;
  model: string;
  prompt: string;
  startedAt: number;
  status: "pending" | "success" | "failed";
}

type Listener = (tasks: QueuedTask[]) => void;
const listeners = new Set<Listener>();

function load(): QueuedTask[] {
  try { const r = localStorage.getItem(STORE_KEY); return r ? JSON.parse(r) : []; }
  catch { return []; }
}

function save(tasks: QueuedTask[]) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(tasks)); } catch {}
}

let tasks = load();
function emit() { for (const l of listeners) l(tasks); }

export function subscribeQueue(l: Listener): () => void {
  listeners.add(l);
  l(tasks);
  return () => listeners.delete(l);
}

export function enqueueTask(t: Omit<QueuedTask, "startedAt" | "status">) {
  tasks = [{ ...t, startedAt: Date.now(), status: "pending" }, ...tasks];
  save(tasks);
  emit();
}

export function updateTaskStatus(taskId: string, status: "success" | "failed") {
  tasks = tasks.map((t) => t.taskId === taskId ? { ...t, status } : t);
  save(tasks);
  emit();
}

export function pendingCount(): number {
  return tasks.filter((t) => t.status === "pending").length;
}

export function getQueue(): QueuedTask[] { return tasks; }

export function clearCompleted() {
  tasks = tasks.filter((t) => t.status === "pending");
  save(tasks);
  emit();
}
