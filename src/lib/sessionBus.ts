type Listener = () => void;
type DeleteListener = (index: number) => void;

let newSessionListeners: Listener[] = [];
let deleteListeners: DeleteListener[] = [];

export function emitNewSession() {
  newSessionListeners.forEach((fn) => fn());
}

export function onNewSession(fn: Listener): () => void {
  newSessionListeners.push(fn);
  return () => { newSessionListeners = newSessionListeners.filter((f) => f !== fn); };
}

export function emitDeleteEntry(index: number) {
  deleteListeners.forEach((fn) => fn(index));
}

export function onDeleteEntry(fn: DeleteListener): () => void {
  deleteListeners.push(fn);
  return () => { deleteListeners = deleteListeners.filter((f) => f !== fn); };
}
