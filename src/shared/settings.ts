import { normalizeLanguageSetting } from "./locale";
import type { LanguageSetting } from "./locale";

export type DuplicateBehavior = "overwrite" | "skip" | "rename";

export type Settings = {
  filenameTemplate: string;
  duplicateBehavior: DuplicateBehavior;
  preferOriginalImage: boolean;
  language: LanguageSetting;
};

const defaultSettings: Settings = {
  filenameTemplate: "{author}_{tweetId}",
  duplicateBehavior: "overwrite",
  preferOriginalImage: true,
  language: "auto",
};

export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(defaultSettings);
  return normalizeSettings(result);
}

export function normalizeSettings(result: Record<string, unknown>): Settings {
  return {
    filenameTemplate:
      typeof result.filenameTemplate === "string"
        ? result.filenameTemplate
        : defaultSettings.filenameTemplate,
    duplicateBehavior: isDuplicateBehavior(result.duplicateBehavior)
      ? result.duplicateBehavior
      : defaultSettings.duplicateBehavior,
    preferOriginalImage:
      typeof result.preferOriginalImage === "boolean"
        ? result.preferOriginalImage
        : defaultSettings.preferOriginalImage,
    language: normalizeLanguageSetting(result.language),
  };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await chrome.storage.sync.set(settings);
}

function isDuplicateBehavior(value: unknown): value is DuplicateBehavior {
  return value === "overwrite" || value === "skip" || value === "rename";
}
