import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  clearDirectoryHandle,
  getDirectoryHandle,
  getDirectoryStorageKey,
  getSavedFileRecord,
  getSavedFileRecordStorageKey,
  saveDirectoryHandle,
  saveSavedFileRecord,
} from "./file-system-db";

describe("file-system-db storage keys", () => {
  test("separates directory handles by media type", () => {
    expect(getDirectoryStorageKey("image")).toBe("save-directory:image");
    expect(getDirectoryStorageKey("video")).toBe("save-directory:video");
    expect(getDirectoryStorageKey("gif")).toBe("save-directory:gif");
  });

  test("uses image as the default directory media type", () => {
    expect(getDirectoryStorageKey()).toBe(getDirectoryStorageKey("image"));
  });

  test("separates saved file records by media type", () => {
    expect(getSavedFileRecordStorageKey("tweet.mp4", "video")).toBe("video:tweet.mp4");
    expect(getSavedFileRecordStorageKey("tweet.jpg", "image")).toBe("image:tweet.jpg");
    expect(getSavedFileRecordStorageKey("tweet.gif", "gif")).toBe("gif:tweet.gif");
  });

  test("uses image as the default saved file record media type", () => {
    expect(getSavedFileRecordStorageKey("tweet.jpg")).toBe(
      getSavedFileRecordStorageKey("tweet.jpg", "image"),
    );
  });
});

describe("file-system-db media type storage", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", createFakeIndexedDB());
  });

  test("keeps directory handles independent by media type", async () => {
    const imageHandle = createDirectoryHandle("images");
    const videoHandle = createDirectoryHandle("videos");

    await saveDirectoryHandle(imageHandle, "image");
    await saveDirectoryHandle(videoHandle, "video");

    expect(await getDirectoryHandle("image")).toBe(imageHandle);
    expect(await getDirectoryHandle("video")).toBe(videoHandle);
    expect(await getDirectoryHandle("gif")).toBeNull();
  });

  test("reads the legacy directory handle as the image folder", async () => {
    const legacyHandle = createDirectoryHandle("legacy-images");
    await putRawIndexedDbValue("handles", "save-directory", legacyHandle);

    expect(await getDirectoryHandle("image")).toBe(legacyHandle);
    expect(await getDirectoryHandle("video")).toBeNull();
  });

  test("prefers the media-specific image directory over the legacy directory", async () => {
    const legacyHandle = createDirectoryHandle("legacy-images");
    const imageHandle = createDirectoryHandle("images");
    await putRawIndexedDbValue("handles", "save-directory", legacyHandle);
    await saveDirectoryHandle(imageHandle, "image");

    expect(await getDirectoryHandle("image")).toBe(imageHandle);
  });

  test("clears both current and legacy directory handles for the image media type", async () => {
    const legacyHandle = createDirectoryHandle("legacy-images");
    const imageHandle = createDirectoryHandle("images");
    const videoHandle = createDirectoryHandle("videos");
    await putRawIndexedDbValue("handles", "save-directory", legacyHandle);
    await saveDirectoryHandle(imageHandle, "image");
    await saveDirectoryHandle(videoHandle, "video");

    await clearDirectoryHandle("image");

    expect(await getDirectoryHandle("image")).toBeNull();
    expect(await getDirectoryHandle("video")).toBe(videoHandle);
  });

  test("keeps saved file records independent by media type", async () => {
    await saveSavedFileRecord({ filename: "tweet.mp4", imageKey: "video-key" }, "video");
    await saveSavedFileRecord({ filename: "tweet.gif", imageKey: "gif-key" }, "gif");

    expect(await getSavedFileRecord("tweet.mp4", "video")).toMatchObject({
      imageKey: "video-key",
      mediaType: "video",
    });
    expect(await getSavedFileRecord("tweet.gif", "gif")).toMatchObject({
      imageKey: "gif-key",
      mediaType: "gif",
    });
    expect(await getSavedFileRecord("tweet.mp4", "image")).toBeNull();
  });

  test("reads legacy saved file records as image records", async () => {
    await putRawIndexedDbValue("savedFiles", "tweet.jpg", {
      filename: "tweet.jpg",
      imageKey: "legacy-image-key",
    });

    expect(await getSavedFileRecord("tweet.jpg", "image")).toMatchObject({
      imageKey: "legacy-image-key",
    });
    expect(await getSavedFileRecord("tweet.jpg", "video")).toBeNull();
  });
});

type FakeRequest<T = unknown> = {
  result?: T;
  error?: DOMException | null;
  onsuccess?: () => void;
  onerror?: () => void;
  onupgradeneeded?: () => void;
};

type FakeDatabase = {
  stores: Map<string, Map<IDBValidKey, unknown>>;
};

function createFakeIndexedDB(): IDBFactory {
  const databases = new Map<string, FakeDatabase>();

  return {
    open: (name: string) => {
      const request: FakeRequest<FakeIDBDatabase> = {};

      queueMicrotask(() => {
        const existing = databases.get(name);
        const database = existing || { stores: new Map<string, Map<IDBValidKey, unknown>>() };
        databases.set(name, database);
        request.result = createFakeDatabase(database);

        if (!existing) {
          request.onupgradeneeded?.();
        }

        request.onsuccess?.();
      });

      return request as unknown as IDBOpenDBRequest;
    },
  } as IDBFactory;
}

type FakeIDBDatabase = IDBDatabase & {
  stores: FakeDatabase["stores"];
};

function createFakeDatabase(database: FakeDatabase): FakeIDBDatabase {
  return {
    stores: database.stores,
    objectStoreNames: {
      contains: (storeName: string) => database.stores.has(storeName),
    },
    createObjectStore: (storeName: string) => {
      database.stores.set(storeName, new Map<IDBValidKey, unknown>());
      return {} as IDBObjectStore;
    },
    transaction: (storeName: string) => ({
      objectStore: () => createFakeObjectStore(getStore(database, storeName)),
    }),
    close: () => {},
  } as unknown as FakeIDBDatabase;
}

function createFakeObjectStore(store: Map<IDBValidKey, unknown>): IDBObjectStore {
  return {
    get: (key: IDBValidKey) => createSuccessfulRequest(store.get(key)),
    put: (value: unknown, key: IDBValidKey) => {
      store.set(key, value);
      return createSuccessfulRequest(key);
    },
    delete: (key: IDBValidKey) => {
      store.delete(key);
      return createSuccessfulRequest(undefined);
    },
  } as IDBObjectStore;
}

function createSuccessfulRequest<T>(result: T): IDBRequest<T> {
  const request: FakeRequest<T> = {
    result,
    error: null,
  };

  queueMicrotask(() => {
    request.onsuccess?.();
  });

  return request as unknown as IDBRequest<T>;
}

function getStore(database: FakeDatabase, storeName: string): Map<IDBValidKey, unknown> {
  const store = database.stores.get(storeName);

  if (!store) {
    throw new Error(`Missing fake object store: ${storeName}`);
  }

  return store;
}

async function putRawIndexedDbValue(
  storeName: string,
  key: IDBValidKey,
  value: unknown,
): Promise<void> {
  const request = indexedDB.open("x-image-downloader");
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  if (!db.objectStoreNames.contains(storeName)) {
    db.createObjectStore(storeName);
  }

  await new Promise<void>((resolve, reject) => {
    const putRequest = db
      .transaction(storeName, "readwrite")
      .objectStore(storeName)
      .put(value, key);
    putRequest.onsuccess = () => resolve();
    putRequest.onerror = () => reject(putRequest.error);
  });
  db.close();
}

function createDirectoryHandle(name: string): FileSystemDirectoryHandle {
  return { name } as FileSystemDirectoryHandle;
}
