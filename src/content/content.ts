import { getEligibleImage, getVisibleImageRect, isPointInsideRect } from "./image-visibility";
import { createSaveButton } from "./save-button";

type SaveResponse =
  | { ok: true; filename?: string; skipped?: boolean }
  | { ok: false; error: string; reason?: string };

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
  author?: string;
  tweetId?: string;
};

let currentImage: HTMLImageElement | null = null;
let pointerX: number | null = null;
let pointerY: number | null = null;
let visibilityUpdateFrame: number | null = null;

const saveButton = createSaveButton();

document.addEventListener("mouseover", (event) => {
  const image = getEligibleImage(event.target);

  if (!image) {
    return;
  }

  currentImage = image;
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

  if (!currentImage) {
    void logContent("warn", "Save button clicked without a current image.");
    return;
  }

  const info = buildImageInfo(currentImage);
  void logContent("info", "Save button clicked.", info);
  saveButton.setState("saving");

  let response: SaveResponse;

  try {
    response = (await chrome.runtime.sendMessage({
      type: "SAVE_IMAGE",
      payload: info,
    })) as SaveResponse;
  } catch (error) {
    void logContent("error", "Save request failed before receiving a response.", error);
    saveButton.setState("failed");
    return;
  }

  void logContent(
    response.ok ? "info" : "warn",
    response.ok ? "Save request succeeded." : "Save request returned failure.",
    response,
  );

  if (response.ok) {
    saveButton.setState(response.skipped ? "skipped" : "saved");
    return;
  }

  saveButton.setState("failed");

  if (response.reason === "folder-not-selected" || response.reason === "permission-denied") {
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  }
});

function updateButtonVisibility(): void {
  if (!currentImage) {
    return;
  }

  if (pointerX === null || pointerY === null) {
    hideButton();
    return;
  }

  const imageRect = getVisibleImageRect(currentImage);

  if (!imageRect) {
    hideButton();
    return;
  }

  const buttonRect = saveButton.element.getBoundingClientRect();

  if (
    !isPointInsideRect(pointerX, pointerY, imageRect) &&
    !isPointInsideRect(pointerX, pointerY, buttonRect)
  ) {
    clearButtonTarget();
    return;
  }

  saveButton.showForViewportRect(imageRect);
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
  currentImage = null;
  pointerX = null;
  pointerY = null;
}

function buildImageInfo(image: HTMLImageElement): ImageInfo {
  const statusInfo = findStatusInfo(image);

  return {
    imageUrl: image.currentSrc || image.src,
    pageUrl: location.href,
    author: statusInfo.author,
    tweetId: statusInfo.tweetId,
  };
}

function findStatusInfo(image: HTMLImageElement): {
  author?: string;
  tweetId?: string;
} {
  const candidates = [
    location.pathname,
    ...Array.from(
      (image.closest("article") || document).querySelectorAll<HTMLAnchorElement>(
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
