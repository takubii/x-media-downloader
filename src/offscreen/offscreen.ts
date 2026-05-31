import { buildFilenameBase, withExtension } from "../shared/filename";
import {
  getDirectoryHandle,
  getSavedFileRecord,
  saveSavedFileRecord,
} from "../shared/file-system-db";
import { getImageKey, getImageMetadata, toOriginalImageUrl } from "../shared/image-url";
import type { RuntimeMessage, SaveImagePayload, SaveImageResponse } from "../shared/messages";
import { getSettings } from "../shared/settings";

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type !== "SAVE_IMAGE_OFFSCREEN" || message.target !== "offscreen") {
      return false;
    }

    saveImage(message.payload)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse(toFailureResponse(error));
      });

    return true;
  },
);

async function saveImage(payload: SaveImagePayload): Promise<SaveImageResponse> {
  const directoryHandle = await getDirectoryHandle();

  if (!directoryHandle) {
    return {
      ok: false,
      error: "Save folder is not selected.",
      reason: "folder-not-selected",
    };
  }

  const permission = await ensureReadWritePermission(directoryHandle);

  if (permission !== "granted") {
    return {
      ok: false,
      error: "Save folder permission was denied.",
      reason: "permission-denied",
    };
  }

  const settings = await getSettings();
  const url = settings.preferOriginalImage
    ? toOriginalImageUrl(payload.imageUrl)
    : payload.imageUrl;
  const blob = await fetchImageBlob(url, payload.imageUrl);
  const metadata = getImageMetadata(payload);
  const imageKey = getImageKey(payload.imageUrl);
  const base = buildFilenameBase(settings.filenameTemplate, metadata);
  const filename = await resolveFilename({
    directoryHandle,
    base,
    ext: metadata.ext,
    imageKey,
    duplicateBehavior: settings.duplicateBehavior,
  });

  if (!filename) {
    return { ok: true, filename: withExtension(base, metadata.ext), skipped: true };
  }

  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  await saveSavedFileRecord({ filename, imageKey });

  return { ok: true, filename };
}

async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  const descriptor: FileSystemHandlePermissionDescriptor = {
    mode: "readwrite",
  };
  const current = await handle.queryPermission(descriptor);

  if (current === "granted") {
    return current;
  }

  return handle.requestPermission(descriptor);
}

async function fetchImageBlob(preferredUrl: string, fallbackUrl: string): Promise<Blob> {
  const preferredResponse = await fetch(preferredUrl);

  if (preferredResponse.ok) {
    return preferredResponse.blob();
  }

  const fallbackResponse = await fetch(fallbackUrl);

  if (fallbackResponse.ok) {
    return fallbackResponse.blob();
  }

  throw new Error(`Image download failed: ${preferredResponse.status}`);
}

type ResolveFilenameInput = {
  directoryHandle: FileSystemDirectoryHandle;
  base: string;
  ext: string;
  imageKey: string;
  duplicateBehavior: "overwrite" | "skip" | "rename";
};

async function resolveFilename(input: ResolveFilenameInput): Promise<string | null> {
  const initialFilename = withExtension(input.base, input.ext);
  const existingFile = await fileExists(input.directoryHandle, initialFilename);

  if (!existingFile) {
    return initialFilename;
  }

  if (input.duplicateBehavior === "skip") {
    return null;
  }

  if (input.duplicateBehavior === "rename") {
    return findAvailableFilename(input.directoryHandle, input.base, input.ext);
  }

  const savedRecord = await getSavedFileRecord(initialFilename);

  if (!savedRecord || savedRecord.imageKey === input.imageKey) {
    return initialFilename;
  }

  const collisionFilename = withExtension(
    `${input.base}_${await shortHash(input.imageKey)}`,
    input.ext,
  );

  return collisionFilename;
}

async function findAvailableFilename(
  directoryHandle: FileSystemDirectoryHandle,
  base: string,
  ext: string,
): Promise<string> {
  for (let count = 2; count < 10_000; count += 1) {
    const candidate = withExtension(`${base}_${count}`, ext);

    if (!(await fileExists(directoryHandle, candidate))) {
      return candidate;
    }
  }

  throw new Error("Could not find an available filename.");
}

async function fileExists(
  directoryHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<boolean> {
  try {
    await directoryHandle.getFileHandle(filename);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "NotFoundError") {
      return false;
    }

    throw error;
  }
}

async function shortHash(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest.slice(0, 4)));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toFailureResponse(error: unknown): SaveImageResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    reason: "download-failed",
  };
}

