import "./options.css";

import { getDirectoryHandle, saveDirectoryHandle } from "../shared/file-system-db";
import { getSettings, saveSettings } from "../shared/settings";
import type { DuplicateBehavior } from "../shared/settings";

const filenameTemplate = getElement<HTMLInputElement>("filenameTemplate");
const duplicateBehavior = getElement<HTMLSelectElement>("duplicateBehavior");
const preferOriginalImage = getElement<HTMLInputElement>("preferOriginalImage");
const chooseFolder = getElement<HTMLButtonElement>("chooseFolder");
const folderStatus = getElement<HTMLParagraphElement>("folderStatus");
const saveStatus = getElement<HTMLParagraphElement>("saveStatus");

void init();

chooseFolder.addEventListener("click", async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    const permission = await handle.requestPermission({ mode: "readwrite" });

    if (permission !== "granted") {
      setSaveStatus("Folder permission was not granted.");
      return;
    }

    await saveDirectoryHandle(handle);
    folderStatus.textContent = `Selected: ${handle.name}`;
    setSaveStatus("Folder saved.");
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      setSaveStatus("Folder selection cancelled.");
      return;
    }

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
}

async function persistSettings(): Promise<void> {
  await saveSettings({
    filenameTemplate: filenameTemplate.value,
    duplicateBehavior: duplicateBehavior.value as DuplicateBehavior,
    preferOriginalImage: preferOriginalImage.checked,
  });
  setSaveStatus("Settings saved.");
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
