// IndexedDB media vault — saves result blobs locally so they survive kie.ai's
// 14-day URL expiry. Opt-in per entry; LRU eviction beyond a size cap.

const DB_NAME = "kie_vault";
const STORE = "media";
const DB_VERSION = 1;
const MAX_BYTES = 500 * 1024 * 1024; // 500 MB default cap

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "url" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => { dbPromise = null; reject(req.error); };
  });
  return dbPromise;
}

interface VaultEntry {
  url: string;
  blob: Blob;
  savedAt: number;
  size: number;
}

export async function vaultSave(remoteUrl: string): Promise<boolean> {
  try {
    const res = await fetch(remoteUrl);
    if (!res.ok) return false;
    const blob = await res.blob();
    const db = await openDb();
    const entry: VaultEntry = { url: remoteUrl, blob, savedAt: Date.now(), size: blob.size };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    await evictIfNeeded();
    return true;
  } catch {
    return false;
  }
}

const objectUrlCache = new Map<string, string>();

export async function vaultGet(remoteUrl: string): Promise<string | null> {
  try {
    const cached = objectUrlCache.get(remoteUrl);
    if (cached) return cached;
    const db = await openDb();
    const entry = await new Promise<VaultEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(remoteUrl);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (!entry) return null;
    const objectUrl = URL.createObjectURL(entry.blob);
    objectUrlCache.set(remoteUrl, objectUrl);
    return objectUrl;
  } catch {
    return null;
  }
}

export function vaultRevokeUrl(remoteUrl: string): void {
  const objectUrl = objectUrlCache.get(remoteUrl);
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrlCache.delete(remoteUrl);
  }
}

export async function vaultHas(remoteUrl: string): Promise<boolean> {
  try {
    const db = await openDb();
    const count = await new Promise<number>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).count(IDBKeyRange.only(remoteUrl));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return count > 0;
  } catch {
    return false;
  }
}

export async function vaultDelete(remoteUrl: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(remoteUrl);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function vaultUsage(): Promise<{ used: number; cap: number }> {
  try {
    const db = await openDb();
    const entries = await allEntries(db);
    const used = entries.reduce((sum, e) => sum + e.size, 0);
    return { used, cap: MAX_BYTES };
  } catch {
    return { used: 0, cap: MAX_BYTES };
  }
}

async function allEntries(db: IDBDatabase): Promise<VaultEntry[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function evictIfNeeded(): Promise<void> {
  const db = await openDb();
  const entries = await allEntries(db);
  let totalSize = entries.reduce((sum, e) => sum + e.size, 0);
  if (totalSize <= MAX_BYTES) return;
  entries.sort((a, b) => a.savedAt - b.savedAt);
  const tx = db.transaction(STORE, "readwrite");
  for (const e of entries) {
    if (totalSize <= MAX_BYTES) break;
    tx.objectStore(STORE).delete(e.url);
    totalSize -= e.size;
  }
  await new Promise<void>((resolve) => { tx.oncomplete = () => resolve(); });
}
