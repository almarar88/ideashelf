// Minimal IndexedDB wrapper: files (binary/base64) and messages per group.
import type { Message } from "./types";

const DB_NAME = "majlis";
const DB_VER = 1;
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("files")) db.createObjectStore("files", { keyPath: "id" });
      if (!db.objectStoreNames.contains("messages")) db.createObjectStore("messages", { keyPath: "groupId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export interface StoredFile { id: string; data: string; /* base64 (binary) or plain text */ text: boolean; }

export const filesDB = {
  put: (f: StoredFile) => tx("files", "readwrite", (s) => s.put(f)),
  get: (id: string) => tx<StoredFile | undefined>("files", "readonly", (s) => s.get(id)),
  del: (id: string) => tx("files", "readwrite", (s) => s.delete(id)),
  clear: () => tx("files", "readwrite", (s) => s.clear()),
};

export const messagesDB = {
  get: async (groupId: string): Promise<Message[]> => {
    const r = await tx<{ groupId: string; list: Message[] } | undefined>("messages", "readonly", (s) => s.get(groupId));
    return r?.list ?? [];
  },
  put: (groupId: string, list: Message[]) => tx("messages", "readwrite", (s) => s.put({ groupId, list })),
  del: (groupId: string) => tx("messages", "readwrite", (s) => s.delete(groupId)),
  clear: () => tx("messages", "readwrite", (s) => s.clear()),
};
