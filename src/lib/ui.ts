// Tiny global UI buses — no context wiring needed.
// 1) Toasts: `toast(msg)` from anywhere; <Toaster /> renders them.
// 2) Key modal: `requestKey()` from anywhere; <App /> opens the modal.

export type ToastKind = "info" | "success" | "error";
export interface Toast { id: number; message: string; kind: ToastKind }

type ToastListener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
let seq = 0;
const toastListeners = new Set<ToastListener>();

function emit() {
  for (const l of toastListeners) l(toasts);
}

export function subscribeToasts(l: ToastListener): () => void {
  toastListeners.add(l);
  l(toasts);
  return () => toastListeners.delete(l);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(message: string, kind: ToastKind = "info", ttlMs = 4000) {
  const id = ++seq;
  toasts = [...toasts, { id, message, kind }];
  emit();
  if (ttlMs > 0) setTimeout(() => dismissToast(id), ttlMs);
}

// ── Key modal bus ────────────────────────────────────────────────────────────

type KeyListener = () => void;
const keyListeners = new Set<KeyListener>();

/** Ask the app shell to open the API-key modal (e.g. on an action with no key). */
export function requestKey() {
  for (const l of keyListeners) l();
}

export function subscribeKeyRequests(l: KeyListener): () => void {
  keyListeners.add(l);
  return () => keyListeners.delete(l);
}
