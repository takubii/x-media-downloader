import { getContentImageKey } from "./image-key";
import {
  getEligibleImage,
  getVisibleImageRect,
  isElementUncovered,
  isPointInsideRect,
} from "./image-visibility";
import { createImageSaveStateStore } from "./save-state";
import { createSaveButton } from "./save-button";
import { getXVideoKey, resolveXVideoCandidate } from "./video-target";
import type { SaveMediaResponse, SaveVideoPayload } from "../shared/messages";

type DebugLogLevel = "debug" | "info" | "warn" | "error";

type DebugLogEntry = {
  timestamp: string;
  source: "content";
  level: DebugLogLevel;
  message: string;
  details?: string;
};

type ImageInfo = {
  imageUrl: string;
  pageUrl: string;
  mediaType: "image";
  author?: string;
  tweetId?: string;
};

type ImageMediaTarget = {
  kind: "image";
  element: HTMLImageElement;
  key: string;
};

type VideoMediaTarget = {
  kind: "video";
  element: HTMLVideoElement;
  key: string;
  info: SaveVideoPayload;
};

type MediaTarget = ImageMediaTarget | VideoMediaTarget;

const MIN_VIDEO_SIZE = 80;

let currentMediaTarget: MediaTarget | null = null;
let pointerX: number | null = null;
let pointerY: number | null = null;
let visibilityUpdateFrame: number | null = null;

const saveButton = createSaveButton();
const saveStates = createImageSaveStateStore();

document.addEventListener("mouseover", (event) => {
  const mediaTarget = getEligibleMediaTarget(event);

  if (!mediaTarget) {
    return;
  }

  currentMediaTarget = mediaTarget;
  pointerX = event.clientX;
  pointerY = event.clientY;
  updateButtonVisibility();
});

document.addEventListener(
  "mousemove",
  (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    updateButtonVisibility();
  },
  { passive: true },
);

document.addEventListener(
  "mouseout",
  (event) => {
    if (!event.relatedTarget) {
      clearButtonTarget();
    }
  },
  { passive: true },
);

document.addEventListener(
  "scroll",
  () => {
    requestButtonVisibilityUpdate();
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  requestButtonVisibilityUpdate();
});

saveButton.element.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!currentMediaTarget) {
    void logContent("warn", "Save button clicked without a current media target.");
    return;
  }

  const target = currentMediaTarget;
  const mediaKey = target.key;

  if (saveStates.isSaving(mediaKey)) {
    void logContent("info", "Ignoring duplicate save click while media is saving.", {
      mediaKey,
    });
    return;
  }

  if (target.kind === "video") {
    void logContent("info", "Save video/GIF button clicked.", target.info);
    await saveMedia(mediaKey, {
      type: "SAVE_VIDEO",
      payload: target.info,
    });
    return;
  }

  const info = buildImageInfo(target.element);
  void logContent("info", "Save button clicked.", info);
  await saveMedia(mediaKey, {
    type: "SAVE_IMAGE",
    payload: info,
  });
});

async function saveMedia(
  mediaKey: string,
  message:
    | { type: "SAVE_IMAGE"; payload: ImageInfo }
    | { type: "SAVE_VIDEO"; payload: SaveVideoPayload },
): Promise<void> {
  saveStates.set(mediaKey, "saving");
  updateVisibleButtonState(mediaKey);

  let response: SaveMediaResponse;

  try {
    response = (await chrome.runtime.sendMessage(message)) as SaveMediaResponse;
  } catch (error) {
    void logContent("error", "Save request failed before receiving a response.", error);
    saveStates.set(mediaKey, "failed");
    updateVisibleButtonState(mediaKey);
    return;
  }

  void logContent(
    response.ok ? "info" : "warn",
    response.ok ? "Save request succeeded." : "Save request returned failure.",
    response,
  );

  if (response.ok) {
    saveStates.set(mediaKey, response.skipped ? "skipped" : "saved");
    updateVisibleButtonState(mediaKey);
    return;
  }

  saveStates.set(mediaKey, "failed");
  updateVisibleButtonState(mediaKey);

  if (response.reason === "folder-not-selected" || response.reason === "permission-denied") {
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  }
}

function updateButtonVisibility(): void {
  if (!currentMediaTarget) {
    return;
  }

  if (pointerX === null || pointerY === null) {
    hideButton();
    return;
  }

  const mediaRect = getVisibleMediaRect(currentMediaTarget);

  if (!mediaRect) {
    hideButton();
    return;
  }

  const buttonRect = saveButton.element.getBoundingClientRect();

  if (
    !isPointInsideRect(pointerX, pointerY, mediaRect) &&
    !isPointInsideRect(pointerX, pointerY, buttonRect)
  ) {
    clearButtonTarget();
    return;
  }

  saveButton.setState(saveStates.get(currentMediaTarget.key));
  saveButton.showForViewportRect(mediaRect);
}

function requestButtonVisibilityUpdate(): void {
  if (visibilityUpdateFrame !== null) {
    return;
  }

  visibilityUpdateFrame = window.requestAnimationFrame(() => {
    visibilityUpdateFrame = null;
    updateButtonVisibility();
  });
}

function hideButton(): void {
  saveButton.hide();
}

function clearButtonTarget(): void {
  hideButton();
  currentMediaTarget = null;
  pointerX = null;
  pointerY = null;
}

function updateVisibleButtonState(mediaKey: string): void {
  if (!currentMediaTarget || currentMediaTarget.key !== mediaKey) {
    return;
  }

  updateButtonVisibility();
}

function buildImageInfo(image: HTMLImageElement): ImageInfo {
  const statusInfo = findStatusInfo(image);

  return {
    imageUrl: image.currentSrc || image.src,
    pageUrl: location.href,
    mediaType: "image",
    author: statusInfo.author,
    tweetId: statusInfo.tweetId,
  };
}

function getEligibleMediaTarget(event: MouseEvent): MediaTarget | null {
  const image = getEligibleImage(event.target);

  if (image) {
    return {
      kind: "image",
      element: image,
      key: getContentImageKey(image.currentSrc || image.src),
    };
  }

  return getEligibleVideoTarget(event);
}

function getEligibleVideoTarget(event: MouseEvent): VideoMediaTarget | null {
  if (!(event.target instanceof Element)) {
    return null;
  }

  const video = findHoveredVideo(event.target, event.clientX, event.clientY);

  if (!video) {
    return null;
  }

  const videoSrc = video.currentSrc || video.src;
  const candidate =
    resolveXVideoCandidate({ videoSrc, posterUrl: video.poster }) ||
    resolveXVideoCandidate({
      videoSrc,
      posterUrl: video.poster,
      sourceText: document.documentElement.innerHTML,
    });

  if (!candidate) {
    return null;
  }

  const statusInfo = findStatusInfo(video);

  return {
    kind: "video",
    element: video,
    key: getXVideoKey(candidate.videoUrl),
    info: {
      videoUrl: candidate.videoUrl,
      pageUrl: location.href,
      mediaType: candidate.mediaType,
      posterUrl: video.poster || undefined,
      bitrate: candidate.bitrate,
      author: statusInfo.author,
      tweetId: statusInfo.tweetId,
    },
  };
}

function findHoveredVideo(
  target: Element,
  pointerX: number,
  pointerY: number,
): HTMLVideoElement | null {
  const root = target.closest("article") || document;
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));

  return (
    videos.find((video) => {
      const rect = video.getBoundingClientRect();

      return (
        rect.width >= MIN_VIDEO_SIZE &&
        rect.height >= MIN_VIDEO_SIZE &&
        isPointInsideRect(pointerX, pointerY, rect)
      );
    }) || null
  );
}

function getVisibleMediaRect(target: MediaTarget): DOMRect | null {
  if (target.kind === "image") {
    return getVisibleImageRect(target.element);
  }

  return getVisibleVideoRect(target.element);
}

function getVisibleVideoRect(video: HTMLVideoElement): DOMRect | null {
  if (!video.isConnected) {
    return null;
  }

  const rect = video.getBoundingClientRect();

  if (rect.width < MIN_VIDEO_SIZE || rect.height < MIN_VIDEO_SIZE) {
    return null;
  }

  if (
    rect.top < 0 ||
    rect.left < 0 ||
    rect.bottom > window.innerHeight ||
    rect.right > window.innerWidth
  ) {
    return null;
  }

  if (!isElementUncovered(video, rect)) {
    return null;
  }

  return rect;
}

function findStatusInfo(element: Element): {
  author?: string;
  tweetId?: string;
} {
  const candidates = [
    location.pathname,
    ...Array.from(
      (element.closest("article") || document).querySelectorAll<HTMLAnchorElement>(
        'a[href*="/status/"]',
      ),
    ).map((anchor) => anchor.getAttribute("href") || ""),
  ];

  for (const candidate of candidates) {
    const match = candidate.match(/\/([^/?#]+)\/status\/(\d+)/);

    if (match) {
      return {
        author: match[1],
        tweetId: match[2],
      };
    }
  }

  return {};
}

async function logContent(level: DebugLogLevel, message: string, details?: unknown): Promise<void> {
  if (!__LOCAL_BUILD__) {
    return;
  }

  const entry: DebugLogEntry = {
    timestamp: new Date().toISOString(),
    source: "content",
    level,
    message,
    details: stringifyDetails(details),
  };
  writeDebugConsole(entry);

  try {
    await chrome.runtime.sendMessage({ type: "DEBUG_LOG", entry });
  } catch {
    // This is expected after the extension is reloaded while an existing X tab
    // still has the old content script injected.
  }
}

function writeDebugConsole(entry: DebugLogEntry): void {
  const text = `[x-image-downloader] [${entry.source}] ${entry.message}`;
  const details = entry.details ? JSON.parse(entry.details) : undefined;

  if (entry.level === "error") {
    console.error(text, details);
    return;
  }

  if (entry.level === "warn") {
    console.warn(text, details);
    return;
  }

  if (entry.level === "info") {
    console.info(text, details);
    return;
  }

  console.debug(text, details);
}

function stringifyDetails(details: unknown): string | undefined {
  if (details === undefined) {
    return undefined;
  }

  if (details instanceof Error) {
    return JSON.stringify({
      name: details.name,
      message: details.message,
      stack: details.stack,
    });
  }

  try {
    return JSON.stringify(details);
  } catch {
    return JSON.stringify(String(details));
  }
}
