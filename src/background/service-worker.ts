import type { RuntimeMessage, SaveImageResponse } from "../shared/messages";

const OFFSCREEN_DOCUMENT_PATH = "src/offscreen/offscreen.html";

chrome.runtime.onInstalled.addListener(() => {
  void chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "OPEN_OPTIONS") {
      void chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return false;
    }

    if (message.type !== "SAVE_IMAGE") {
      return false;
    }

    saveImageViaOffscreen(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: getErrorMessage(error),
          reason: "download-failed",
        } satisfies SaveImageResponse);
      });

    return true;
  },
);

async function saveImageViaOffscreen(
  message: Extract<RuntimeMessage, { type: "SAVE_IMAGE" }>,
): Promise<SaveImageResponse> {
  await ensureOffscreenDocument();

  return chrome.runtime.sendMessage({
    type: "SAVE_IMAGE_OFFSCREEN",
    target: "offscreen",
    payload: message.payload,
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
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen.createDocument({
      url: OFFSCREEN_DOCUMENT_PATH,
      reasons: ["BLOBS"],
      justification: "Save fetched X image blobs to the selected local folder.",
    });
  }

  await creatingOffscreenDocument;
  creatingOffscreenDocument = null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
