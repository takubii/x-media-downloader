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

const BUTTON_SIZE = 34;
const BUTTON_MARGIN = 8;
const MEDIA_HOST = "pbs.twimg.com";

let currentImage: HTMLImageElement | null = null;
let hideTimer: number | null = null;

const host = document.createElement("div");
host.id = "x-image-downloader-root";
document.documentElement.appendChild(host);

const shadow = host.attachShadow({ mode: "open" });
shadow.innerHTML = `
  <style>
    :host {
      all: initial;
    }

    button {
      position: fixed;
      z-index: 2147483647;
      width: ${BUTTON_SIZE}px;
      height: ${BUTTON_SIZE}px;
      display: none;
      align-items: center;
      justify-content: center;
      border: 0;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      color: white;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      font: 700 18px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    button:hover {
      background: rgba(2, 6, 23, 0.96);
    }
  </style>
  <button type="button" title="Save image" aria-label="Save image">↓</button>
`;

const button = shadow.querySelector("button");

if (!button) {
  throw new Error("Failed to create save button.");
}

const saveButton = button;

document.addEventListener("mouseover", (event) => {
  const image = getEligibleImage(event.target);

  if (!image) {
    return;
  }

  currentImage = image;
  showButton(image);
});

document.addEventListener(
  "scroll",
  () => {
    if (currentImage) {
      showButton(currentImage);
    }
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  if (currentImage) {
    showButton(currentImage);
  }
});

saveButton.addEventListener("mouseenter", () => {
  clearHideTimer();
});

saveButton.addEventListener("mouseleave", () => {
  scheduleHide();
});

saveButton.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (!currentImage) {
    void logContent("warn", "Save button clicked without a current image.");
    return;
  }

  const info = buildImageInfo(currentImage);
  void logContent("info", "Save button clicked.", info);
  setButtonState("saving");

  let response: SaveResponse;

  try {
    response = (await chrome.runtime.sendMessage({
      type: "SAVE_IMAGE",
      payload: info,
    })) as SaveResponse;
  } catch (error) {
    void logContent("error", "Save request failed before receiving a response.", error);
    setButtonState("failed");
    return;
  }

  void logContent(
    response.ok ? "info" : "warn",
    response.ok ? "Save request succeeded." : "Save request returned failure.",
    response,
  );

  if (response.ok) {
    setButtonState(response.skipped ? "skipped" : "saved");
    return;
  }

  setButtonState("failed");

  if (
    response.reason === "folder-not-selected" ||
    response.reason === "permission-denied"
  ) {
    await chrome.runtime.sendMessage({ type: "OPEN_OPTIONS" });
  }
});

function getEligibleImage(target: EventTarget | null): HTMLImageElement | null {
  if (!(target instanceof HTMLImageElement)) {
    return null;
  }

  if (!isXImageUrl(target.currentSrc || target.src)) {
    return null;
  }

  const rect = target.getBoundingClientRect();

  if (rect.width < 80 || rect.height < 80) {
    return null;
  }

  return target;
}

function isXImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === MEDIA_HOST && url.pathname.includes("/media/");
  } catch {
    return false;
  }
}

function showButton(image: HTMLImageElement): void {
  clearHideTimer();

  const rect = image.getBoundingClientRect();
  const top = Math.max(BUTTON_MARGIN, rect.top + BUTTON_MARGIN);
  const left = Math.min(
    window.innerWidth - BUTTON_SIZE - BUTTON_MARGIN,
    rect.right - BUTTON_SIZE - BUTTON_MARGIN,
  );

  saveButton.style.top = `${top}px`;
  saveButton.style.left = `${Math.max(BUTTON_MARGIN, left)}px`;
  saveButton.style.display = "flex";

  scheduleHide();
}

function scheduleHide(): void {
  clearHideTimer();
  hideTimer = window.setTimeout(() => {
    saveButton.style.display = "none";
    currentImage = null;
  }, 1800);
}

function clearHideTimer(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function setButtonState(state: "saving" | "saved" | "skipped" | "failed"): void {
  if (state === "saving") {
    saveButton.textContent = "...";
    return;
  }

  if (state === "saved") {
    saveButton.textContent = "✓";
  } else if (state === "skipped") {
    saveButton.textContent = "-";
  } else {
    saveButton.textContent = "!";
  }

  window.setTimeout(() => {
    saveButton.textContent = "↓";
  }, 900);
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

async function logContent(
  level: DebugLogLevel,
  message: string,
  details?: unknown,
): Promise<void> {
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
