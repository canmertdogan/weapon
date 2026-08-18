const DB_NAME = 'weapon-cache';
const DB_VERSION = 1;
const BINARY_STORE = 'binaries';
const STATE_STORE = 'interactive-state';

interface BinaryCacheEntry {
  url: string;
  data: string;
  timestamp: number;
  size: number;
}

interface InteractiveStateEntry {
  key: string;
  state: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(BINARY_STORE)) {
          const store = db.createObjectStore(BINARY_STORE, { keyPath: 'url' });
          store.createIndex('timestamp', 'timestamp');
        }
        if (!db.objectStoreNames.contains(STATE_STORE)) {
          db.createObjectStore(STATE_STORE, { keyPath: 'key' });
        }
      };
    });
  }
  return dbPromise;
}

export async function cacheBinary(url: string, data: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(BINARY_STORE, 'readwrite');
  const store = tx.objectStore(BINARY_STORE);
  const entry: BinaryCacheEntry = {
    url,
    data,
    timestamp: Date.now(),
    size: data.length,
  };
  await new Promise<void>((resolve, reject) => {
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// `expectedBytes`, when given, invalidates a cached entry whose stored data
// no longer matches the manifest's declared size — the only signal we have
// that a binary at this URL was regenerated since it was last cached.
export async function getCachedBinary(url: string, expectedBytes?: number): Promise<string | null> {
  const db = await getDB();
  const tx = db.transaction(BINARY_STORE, 'readonly');
  const store = tx.objectStore(BINARY_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(url);
    req.onsuccess = () => {
      const entry = req.result as BinaryCacheEntry | undefined;
      if (!entry) {
        resolve(null);
        return;
      }
      if (expectedBytes !== undefined && entry.data.length / 2 !== expectedBytes) {
        resolve(null);
        return;
      }
      resolve(entry.data);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearBinaryCache(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(BINARY_STORE, 'readwrite');
  const store = tx.objectStore(BINARY_STORE);
  await new Promise<void>((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function saveInteractiveState(key: string, state: unknown): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STATE_STORE, 'readwrite');
  const store = tx.objectStore(STATE_STORE);
  const entry: InteractiveStateEntry = {
    key,
    state,
    timestamp: Date.now(),
  };
  await new Promise<void>((resolve, reject) => {
    const req = store.put(entry);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getInteractiveState(key: string): Promise<unknown | null> {
  const db = await getDB();
  const tx = db.transaction(STATE_STORE, 'readonly');
  const store = tx.objectStore(STATE_STORE);
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => {
      const entry = req.result as InteractiveStateEntry | undefined;
      if (entry) {
        resolve(entry.state);
      } else {
        resolve(null);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export function saveSessionState(key: string, state: unknown): void {
  try {
    sessionStorage.setItem(`weapon:${key}`, JSON.stringify({ state, timestamp: Date.now() }));
  } catch (e) {
    console.warn('Failed to save session state:', e);
  }
}

export function getSessionState<T>(key: string): T | null {
  try {
    const stored = sessionStorage.getItem(`weapon:${key}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    return parsed.state as T;
  } catch {
    return null;
  }
}

export function clearSessionState(key: string): void {
  try {
    sessionStorage.removeItem(`weapon:${key}`);
  } catch {}
}

export async function exportProgress(progress: unknown): Promise<string> {
  const cacheInfo = await getCacheInfo();
  const exportData = {
    version: 1,
    timestamp: Date.now(),
    progress,
    cacheInfo,
  };
  return JSON.stringify(exportData, null, 2);
}

export async function importProgress(json: string): Promise<{ progress: unknown; cacheInfo: unknown } | null> {
  try {
    const data = JSON.parse(json);
    if (!data.version || !data.progress) {
      throw new Error('Invalid progress export format');
    }
    return { progress: data.progress, cacheInfo: data.cacheInfo };
  } catch (e) {
    console.error('Failed to import progress:', e);
    return null;
  }
}

async function getCacheInfo(): Promise<{ count: number; totalSize: number; oldestEntry: number | null }> {
  const db = await getDB();
  const tx = db.transaction(BINARY_STORE, 'readonly');
  const store = tx.objectStore(BINARY_STORE);
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const entries = req.result as BinaryCacheEntry[];
      let totalSize = 0;
      let oldest: number | null = null;
      for (const entry of entries) {
        totalSize += entry.size;
        if (oldest === null || entry.timestamp < oldest) {
          oldest = entry.timestamp;
        }
      }
      resolve({ count: entries.length, totalSize, oldestEntry: oldest });
    };
    req.onerror = () => reject(req.error);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}