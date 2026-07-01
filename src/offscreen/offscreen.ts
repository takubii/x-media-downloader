import { buildFilenameBase, withExtension } from "../shared/filename";
import {
  getDirectoryHandle,
  getSavedFileRecord,
  saveSavedFileRecord,
} from "../shared/file-system-db";
import { sendDebugLog } from "../shared/debug-log";
import { getImageKey, getImageMetadata, toOriginalImageUrl } from "../shared/image-url";
import { normalizeMediaType } from "../shared/media-type";
import type { MediaType } from "../shared/media-type";
import type {
  RuntimeMessage,
  SaveImagePayload,
  SaveMediaResponse,
  SaveVideoPayload,
} from "../shared/messages";
import type { Settings } from "../shared/settings";
import { getVideoKey, getVideoMetadata } from "../shared/video-url";

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "SAVE_IMAGE_OFFSCREEN" && message.target === "offscreen") {
    void logOffscreen("info", "Offscreen image save request received.", {
      imageUrl: message.payload.imageUrl,
      pageUrl: message.payload.pageUrl,
    });

    saveImage(message.payload, message.settings)
      .then(sendResponse)
      .catch((error: unknown) => {
        void logOffscreen("error", "Offscreen image save request failed.", error);
        sendResponse(toFailureResponse(error));
      });

    return true;
  }

  if (message.type === "SAVE_VIDEO_OFFSCREEN" && message.target === "offscreen") {
    void logOffscreen("info", "Offscreen video/GIF save request received.", {
      videoUrl: message.payload.videoUrl,
      pageUrl: message.payload.pageUrl,
      mediaType: message.payload.mediaType,
    });

    saveVideo(message.payload, message.settings)
      .then(sendResponse)
      .catch((error: unknown) => {
        void logOffscreen("error", "Offscreen video/GIF save request failed.", error);
        sendResponse(toFailureResponse(error));
      });

    return true;
  }

  return false;
});

async function saveImage(
  payload: SaveImagePayload,
  settings: Settings,
): Promise<SaveMediaResponse> {
  const mediaType = normalizeMediaType(payload.mediaType);
  const url = settings.preferOriginalImage
    ? toOriginalImageUrl(payload.imageUrl)
    : payload.imageUrl;
  const metadata = getImageMetadata(payload);

  return saveFetchedMedia({
    mediaType,
    mediaLabel: "image",
    base: buildFilenameBase(settings.filenameTemplate, metadata),
    ext: metadata.ext,
    mediaKey: getImageKey(payload.imageUrl),
    duplicateBehavior: settings.duplicateBehavior,
    fetchBlob: () => {
      void logOffscreen("debug", "Fetching image blob.", {
        preferredUrl: url,
        fallbackUrl: payload.imageUrl,
      });
      return fetchImageBlob(url, payload.imageUrl);
    },
  });
}

async function saveVideo(
  payload: SaveVideoPayload,
  settings: Settings,
): Promise<SaveMediaResponse> {
  const metadata = getVideoMetadata(payload);

  return saveFetchedMedia({
    mediaType: payload.mediaType,
    mediaLabel: payload.mediaType,
    base: buildFilenameBase(settings.filenameTemplate, metadata),
    ext: metadata.ext,
    mediaKey: getVideoKey(payload.videoUrl),
    duplicateBehavior: settings.duplicateBehavior,
    fetchBlob: () => fetchVideoBlob(payload.videoUrl),
  });
}

type SaveFetchedMediaInput = {
  mediaType: MediaType;
  mediaLabel: string;
  base: string;
  ext: string;
  mediaKey: string;
  duplicateBehavior: "overwrite" | "skip" | "rename";
  fetchBlob: () => Promise<Blob>;
};

async function saveFetchedMedia(input: SaveFetchedMediaInput): Promise<SaveMediaResponse> {
  const directoryHandle = await getDirectoryHandle(input.mediaType);

  if (!directoryHandle) {
    void logOffscreen("warn", "No save folder handle found in IndexedDB.", {
      mediaType: input.mediaType,
    });
    return {
      ok: false,
      error: "Save folder is not selected.",
      reason: "folder-not-selected",
    };
  }

  const permission = await ensureReadWritePermission(directoryHandle);

  if (permission !== "granted") {
    void logOffscreen("warn", "Save folder permission was not granted.", {
      mediaType: input.mediaType,
      permission,
    });
    return {
      ok: false,
      error: "Save folder permission was denied.",
      reason: "permission-denied",
    };
  }

  const filename = await resolveFilename({
    directoryHandle,
    base: input.base,
    ext: input.ext,
    mediaKey: input.mediaKey,
    mediaType: input.mediaType,
    duplicateBehavior: input.duplicateBehavior,
  });

  if (!filename) {
    void logOffscreen("info", "Save skipped by duplicate behavior.", {
      mediaType: input.mediaType,
      filename: withExtension(input.base, input.ext),
    });
    return { ok: true, filename: withExtension(input.base, input.ext), skipped: true };
  }

  const blob = await input.fetchBlob();
  void logOffscreen("debug", `Writing ${input.mediaLabel} file.`, {
    mediaType: input.mediaType,
    filename,
    size: blob.size,
    type: blob.type,
  });
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
  await saveSavedFileRecord({ filename, imageKey: input.mediaKey }, input.mediaType);

  void logOffscreen("info", `${input.mediaLabel} file saved.`, {
    mediaType: input.mediaType,
    filename,
  });
  return { ok: true, filename };
}

async function ensureReadWritePermission(
  handle: FileSystemDirectoryHandle,
): Promise<PermissionState> {
  const descriptor: FileSystemHandlePermissionDescriptor = {
    mode: "readwrite",
  };
  const current = await handle.queryPermission(descriptor);
  void logOffscreen("debug", "Queried save folder permission.", { current });

  if (current === "granted") {
    return current;
  }

  const requested = await handle.requestPermission(descriptor);
  void logOffscreen("debug", "Requested save folder permission.", { requested });
  return requested;
}

async function fetchImageBlob(preferredUrl: string, fallbackUrl: string): Promise<Blob> {
  const preferredResponse = await fetch(preferredUrl);
  void logOffscreen("debug", "Preferred image fetch completed.", {
    status: preferredResponse.status,
    ok: preferredResponse.ok,
    url: preferredUrl,
  });

  if (preferredResponse.ok) {
    return preferredResponse.blob();
  }

  const fallbackResponse = await fetch(fallbackUrl);
  void logOffscreen("debug", "Fallback image fetch completed.", {
    status: fallbackResponse.status,
    ok: fallbackResponse.ok,
    url: fallbackUrl,
  });

  if (fallbackResponse.ok) {
    return fallbackResponse.blob();
  }

  throw new Error(`Image download failed: ${preferredResponse.status}`);
}

async function fetchVideoBlob(videoUrl: string): Promise<Blob> {
  void logOffscreen("debug", "Fetching video blob.", { videoUrl });
  const response = await fetch(videoUrl);
  void logOffscreen("debug", "Video fetch completed.", {
    status: response.status,
    ok: response.ok,
    url: videoUrl,
  });

  if (response.ok) {
    return response.blob();
  }

  throw new Error(`Video download failed: ${response.status}`);
}

type ResolveFilenameInput = {
  directoryHandle: FileSystemDirectoryHandle;
  base: string;
  ext: string;
  mediaKey: string;
  mediaType: MediaType;
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

  const savedRecord = await getSavedFileRecord(initialFilename, input.mediaType);

  if (!savedRecord || savedRecord.imageKey === input.mediaKey) {
    return initialFilename;
  }

  const collisionFilename = withExtension(
    `${input.base}_${await shortHash(input.mediaKey)}`,
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

function toFailureResponse(error: unknown): SaveMediaResponse {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    reason: "download-failed",
  };
}

async function logOffscreen(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  details?: unknown,
): Promise<void> {
  await sendDebugLog("offscreen", level, message, details);
}
