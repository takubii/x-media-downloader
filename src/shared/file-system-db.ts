const DB_NAME = "x-image-downloader";
const DB_VERSION = 1;
const HANDLE_STORE = "handles";
const SAVED_FILE_STORE = "savedFiles";
const DIRECTORY_KEY = "save-directory";

export type SavedFileRecord = {
  filename: string;
  imageKey: string;
};

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDatabase();
  await putValue(db, HANDLE_STORE, handle, DIRECTORY_KEY);
  db.close();
}

export async function getDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDatabase();
  const handle = await getValue<FileSystemDirectoryHandle>(db, HANDLE_STORE, DIRECTORY_KEY);
  db.close();
  return handle ?? null;
}

export async function clearDirectoryHandle(): Promise<void> {
  const db = await openDatabase();
  await deleteValue(db, HANDLE_STORE, DIRECTORY_KEY);
  db.close();
}

export async function getSavedFileRecord(filename: string): Promise<SavedFileRecord | null> {
  const db = await openDatabase();
  const record = await getValue<SavedFileRecord>(db, SAVED_FILE_STORE, filename);
  db.close();
  return record ?? null;
}

export async function saveSavedFileRecord(record: SavedFileRecord): Promise<void> {
  const db = await openDatabase();
  await putValue(db, SAVED_FILE_STORE, record, record.filename);
  db.close();
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE);
      }

      if (!db.objectStoreNames.contains(SAVED_FILE_STORE)) {
        db.createObjectStore(SAVED_FILE_STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getValue<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readonly");
    const store = transaction.objectStore(storeName);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

function putValue<T>(
  db: IDBDatabase,
  storeName: string,
  value: T,
  key: IDBValidKey,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.put(value, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function deleteValue(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
