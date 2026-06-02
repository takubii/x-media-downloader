import {
  appendDebugLog,
  createDebugLogEntry,
  sendDebugLog,
  writeDebugConsole,
} from "../shared/debug-log";
import type { RuntimeMessage, SaveImageResponse } from "../shared/messages";
import { getSettings } from "../shared/settings";

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";

chrome.runtime.onInstalled.addListener(() => {
  void logBackground("info", "Extension installed; opening options page.");
  void chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message.type === "DEBUG_LOG") {
    writeDebugConsole(message.entry);
    appendDebugLog(message.entry)
      .then(() => sendResponse({ ok: true }))
      .catch((error: unknown) => {
        writeDebugConsole(
          createDebugLogEntry("background", "error", "Failed to persist debug log.", error),
        );
        sendResponse({ ok: false });
      });
    return true;
  }

  if (message.type === "OPEN_OPTIONS") {
    void logBackground("info", "Opening options page by request.");
    void chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }

  if (message.type !== "SAVE_IMAGE") {
    return false;
  }

  void logBackground("info", "Save image request received.", {
    imageUrl: message.payload.imageUrl,
    pageUrl: message.payload.pageUrl,
  });

  saveImageViaOffscreen(message)
    .then((response) => {
      void logBackground(
        response.ok ? "info" : "warn",
        response.ok ? "Save image request completed." : "Save image request failed.",
        response,
      );
      sendResponse(response);
    })
    .catch((error: unknown) => {
      void logBackground("error", "Save image request threw before response.", error);
      sendResponse({
        ok: false,
        error: getErrorMessage(error),
        reason: "download-failed",
      } satisfies SaveImageResponse);
    });

  return true;
});

async function saveImageViaOffscreen(
  message: Extract<RuntimeMessage, { type: "SAVE_IMAGE" }>,
): Promise<SaveImageResponse> {
  await ensureOffscreenDocument();
  const settings = await getSettings();

  void logBackground("debug", "Forwarding save request to offscreen document.", {
    duplicateBehavior: settings.duplicateBehavior,
    preferOriginalImage: settings.preferOriginalImage,
    filenameTemplate: settings.filenameTemplate,
  });

  return chrome.runtime.sendMessage({
    type: "SAVE_IMAGE_OFFSCREEN",
    target: "offscreen",
    payload: message.payload,
    settings,
  } satisfies RuntimeMessage);
}

let creatingOffscreenDocument: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = (await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [offscreenUrl],
  })) as chrome.runtime.ExtensionContext[];

  if (existingContexts.length > 0) {
    void logBackground("debug", "Reusing existing offscreen document.");
    return;
  }

  if (!creatingOffscreenDocument) {
    void logBackground("debug", "Creating offscreen document.");
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["BLOBS"],
      justification: "Save fetched X image blobs to the selected local folder.",
    });
  }

  await creatingOffscreenDocument;
  creatingOffscreenDocument = null;
  void logBackground("debug", "Offscreen document is ready.");
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function logBackground(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  details?: unknown,
): Promise<void> {
  try {
    await sendDebugLog("background", level, message, details);
  } catch (error) {
    writeDebugConsole(
      createDebugLogEntry("background", "error", "Failed to write background debug log.", error),
    );
  }
}
