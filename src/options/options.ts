import "./options.css";

import { clearDebugLogs, readDebugLogs, sendDebugLog } from "../shared/debug-log";
import { getDirectoryHandle, saveDirectoryHandle } from "../shared/file-system-db";
import { getSettings, saveSettings } from "../shared/settings";
import type { DuplicateBehavior } from "../shared/settings";

const filenameTemplate = getElement<HTMLInputElement>("filenameTemplate");
const duplicateBehavior = getElement<HTMLSelectElement>("duplicateBehavior");
const preferOriginalImage = getElement<HTMLInputElement>("preferOriginalImage");
const chooseFolder = getElement<HTMLButtonElement>("chooseFolder");
const folderStatus = getElement<HTMLParagraphElement>("folderStatus");
const saveStatus = getElement<HTMLParagraphElement>("saveStatus");
const refreshLogs = getElement<HTMLButtonElement>("refreshLogs");
const clearLogs = getElement<HTMLButtonElement>("clearLogs");
const debugLogs = getElement<HTMLPreElement>("debugLogs");

void init();

chooseFolder.addEventListener("click", async () => {
  try {
    void logOptions("info", "Choosing save folder.");
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const permission = await handle.requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      void logOptions("warn", "Save folder permission was not granted.", {
        permission,
      });
      setSaveStatus("Folder permission was not granted.");
      return;
    }

    await saveDirectoryHandle(handle);
    void logOptions("info", "Save folder selected.", {
      folderName: handle.name,
    });
    folderStatus.textContent = `Selected: ${handle.name}`;
    setSaveStatus("Folder saved.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      void logOptions("info", "Folder selection cancelled.");
      setSaveStatus("Folder selection cancelled.");
      return;
    }

    void logOptions("error", "Folder selection failed.", error);
    setSaveStatus(getErrorMessage(error));
  }
});

filenameTemplate.addEventListener("input", () => {
  void persistSettings();
});

duplicateBehavior.addEventListener("change", () => {
  void persistSettings();
});

preferOriginalImage.addEventListener("change", () => {
  void persistSettings();
});

refreshLogs.addEventListener("click", () => {
  void renderDebugLogs();
});

clearLogs.addEventListener("click", async () => {
  await clearDebugLogs();
  await logOptions("info", "Debug logs cleared.");
  await renderDebugLogs();
});

async function init(): Promise<void> {
  const [settings, directoryHandle] = await Promise.all([
    getSettings(),
    getDirectoryHandle(),
  ]);

  filenameTemplate.value = settings.filenameTemplate;
  duplicateBehavior.value = settings.duplicateBehavior;
  preferOriginalImage.checked = settings.preferOriginalImage;
  folderStatus.textContent = directoryHandle
    ? `Selected: ${directoryHandle.name}`
    : "No folder selected.";
  await renderDebugLogs();
}

async function persistSettings(): Promise<void> {
  await saveSettings({
    filenameTemplate: filenameTemplate.value,
    duplicateBehavior: duplicateBehavior.value as DuplicateBehavior,
    preferOriginalImage: preferOriginalImage.checked,
  });
  setSaveStatus("Settings saved.");
}

async function renderDebugLogs(): Promise<void> {
  const logs = await readDebugLogs();

  if (logs.length === 0) {
    debugLogs.textContent = "No logs.";
    return;
  }

  debugLogs.textContent = logs
    .map((log) => {
      const details = log.details ? ` ${log.details}` : "";
      return `${log.timestamp} ${log.level.toUpperCase()} [${log.source}] ${log.message}${details}`;
    })
    .join("\n");
  debugLogs.scrollTop = debugLogs.scrollHeight;
}

function setSaveStatus(message: string): void {
  saveStatus.textContent = message;
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing element: ${id}`);
  }

  return element as T;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function logOptions(
  level: "debug" | "info" | "warn" | "error",
  message: string,
  details?: unknown,
): Promise<void> {
  await sendDebugLog("options", level, message, details);
}
