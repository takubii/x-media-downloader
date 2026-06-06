import "./popup.css";

import { getBrowserLanguage, getUiMessages, resolveLocale } from "../shared/locale";
import type { LanguageSetting, UiMessages } from "../shared/locale";
import { getSettings, normalizeSettings, saveSettings } from "../shared/settings";
import type { DuplicateBehavior, Settings } from "../shared/settings";
import {
  applyTranslations,
  chooseSaveFolder,
  clearSaveFolder,
  getFolderState,
  renderFolderCard,
} from "../shared/settings-view";
import type { FolderState } from "../shared/settings-view";

const language = getElement<HTMLSelectElement>("language");
const filenameTemplate = getElement<HTMLInputElement>("filenameTemplate");
const duplicateBehavior = getElement<HTMLSelectElement>("duplicateBehavior");
const preferOriginalImage = getElement<HTMLInputElement>("preferOriginalImage");
const chooseFolder = getElement<HTMLButtonElement>("chooseFolder");
const clearFolder = getElement<HTMLButtonElement>("clearFolder");
const openFullSettings = getElement<HTMLButtonElement>("openFullSettings");
const saveStatus = getElement<HTMLParagraphElement>("saveStatus");

const folderElements = {
  card: getElement<HTMLElement>("folderCard"),
  title: getElement<HTMLElement>("folderTitle"),
  description: getElement<HTMLElement>("folderDescription"),
  name: getElement<HTMLElement>("folderName"),
  action: chooseFolder,
  clear: clearFolder,
};

let settings: Settings = normalizeSettings({});
let folderState: FolderState = { kind: "missing" };
let messages: UiMessages = getUiMessages("en");

void init();

language.addEventListener("change", () => {
  void updateSettings({
    language: language.value as LanguageSetting,
  });
});

filenameTemplate.addEventListener("input", () => {
  void updateSettings({
    filenameTemplate: filenameTemplate.value,
  });
});

duplicateBehavior.addEventListener("change", () => {
  void updateSettings({
    duplicateBehavior: duplicateBehavior.value as DuplicateBehavior,
  });
});

preferOriginalImage.addEventListener("change", () => {
  void updateSettings({
    preferOriginalImage: preferOriginalImage.checked,
  });
});

chooseFolder.addEventListener("click", async () => {
  const result = await chooseSaveFolder();
  folderState = result.folderState;
  render();

  if (result.ok) {
    setStatus(messages.folderSaved);
    return;
  }

  if (result.reason === "cancelled") {
    setStatus(messages.folderSelectionCancelled);
    return;
  }

  if (result.reason === "permission-not-granted") {
    setStatus(messages.folderPermissionNotGranted);
    return;
  }

  if (result.reason === "failed") {
    setStatus(getErrorMessage(result.error));
  }
});

clearFolder.addEventListener("click", async () => {
  await clearSaveFolder();
  folderState = { kind: "missing" };
  render();
  setStatus(messages.folderCleared);
});

openFullSettings.addEventListener("click", () => {
  void chrome.runtime.openOptionsPage();
  window.close();
});

async function init(): Promise<void> {
  [settings, folderState] = await Promise.all([getSettings(), getFolderState()]);
  syncControls();
  render();
}

async function updateSettings(next: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...next };
  await saveSettings(next);
  syncControls();
  render();
  setStatus(messages.settingsSaved);
}

function syncControls(): void {
  language.value = settings.language;
  filenameTemplate.value = settings.filenameTemplate;
  duplicateBehavior.value = settings.duplicateBehavior;
  preferOriginalImage.checked = settings.preferOriginalImage;
}

function render(): void {
  const locale = resolveLocale(settings.language, getBrowserLanguage());
  messages = getUiMessages(locale);
  document.documentElement.lang = locale;
  applyTranslations(document, messages);
  renderFolderCard(folderElements, folderState, messages);
}

function setStatus(message: string): void {
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
