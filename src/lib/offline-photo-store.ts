const DB_NAME = "cv-offline-photos-v1";
const STORE_NAME = "photos";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = fn(store);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
        request.onsuccess = () => resolve(request.result as T);
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      }),
  );
}

export async function saveOfflinePhoto(id: string, blob: Blob): Promise<void> {
  await runTransaction("readwrite", (store) => store.put(blob, id));
}

export async function loadOfflinePhoto(id: string): Promise<Blob | null> {
  try {
    const blob = await runTransaction<Blob | undefined>("readonly", (store) => store.get(id));
    return blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteOfflinePhoto(id: string): Promise<void> {
  try {
    await runTransaction("readwrite", (store) => store.delete(id));
  } catch {
    // ignore — queue metadata is source of truth
  }
}
