export type LanguageSetting = "auto" | "ja" | "en";
export type ResolvedLocale = "ja" | "en";

export type UiMessages = {
  optionsPageTitle: string;
  popupPageTitle: string;
  settingsTitle: string;
  appSubtitle: string;
  languageLabel: string;
  languageAuto: string;
  languageJapanese: string;
  languageEnglish: string;
  saveFolderTitle: string;
  folderNotSelectedTitle: string;
  folderNotSelectedDescription: string;
  folderReadyTitle: string;
  folderReadyDescription: string;
  folderPermissionTitle: string;
  folderPermissionDescription: string;
  chooseFolder: string;
  chooseAgain: string;
  clearFolder: string;
  fileNamingTitle: string;
  filenameTemplateLabel: string;
  filenameTemplateHint: string;
  duplicateBehaviorLabel: string;
  duplicateOverwrite: string;
  duplicateSkip: string;
  duplicateRename: string;
  preferOriginalImageLabel: string;
  openFullSettings: string;
  developerDiagnostics: string;
  developerDiagnosticsHint: string;
  refreshLogs: string;
  clearLogs: string;
  noLogs: string;
  folderSaved: string;
  folderCleared: string;
  folderPermissionNotGranted: string;
  folderSelectionCancelled: string;
  settingsSaved: string;
};

const messages: Record<ResolvedLocale, UiMessages> = {
  en: {
    optionsPageTitle: "X Image Downloader Options",
    popupPageTitle: "X Image Downloader",
    settingsTitle: "Settings",
    appSubtitle: "Save X/Twitter images to a local folder.",
    languageLabel: "Language",
    languageAuto: "Auto",
    languageJapanese: "Japanese",
    languageEnglish: "English",
    saveFolderTitle: "Save Folder",
    folderNotSelectedTitle: "No save folder selected",
    folderNotSelectedDescription: "Choose a folder before saving images.",
    folderReadyTitle: "Ready to save",
    folderReadyDescription: "Images will be saved to this folder.",
    folderPermissionTitle: "Permission required",
    folderPermissionDescription: "Choose the folder again to continue saving images.",
    chooseFolder: "Choose Folder",
    chooseAgain: "Choose Again",
    clearFolder: "Clear Folder",
    fileNamingTitle: "File Naming",
    filenameTemplateLabel: "Filename template",
    filenameTemplateHint:
      "Available variables: {author}, {tweetId}, {date}, {time}, {originalName}",
    duplicateBehaviorLabel: "Duplicate behavior",
    duplicateOverwrite: "Overwrite",
    duplicateSkip: "Skip",
    duplicateRename: "Rename",
    preferOriginalImageLabel: "Prefer original image quality",
    openFullSettings: "Open full settings",
    developerDiagnostics: "Developer diagnostics",
    developerDiagnosticsHint: "Debug logs are kept here while the extension is in development.",
    refreshLogs: "Refresh Logs",
    clearLogs: "Clear Logs",
    noLogs: "No logs.",
    folderSaved: "Folder saved.",
    folderCleared: "Folder cleared.",
    folderPermissionNotGranted: "Folder permission was not granted.",
    folderSelectionCancelled: "Folder selection cancelled.",
    settingsSaved: "Settings saved.",
  },
  ja: {
    optionsPageTitle: "X Image Downloader オプション",
    popupPageTitle: "X Image Downloader",
    settingsTitle: "設定",
    appSubtitle: "X/Twitter の画像をローカルフォルダーに保存します。",
    languageLabel: "言語",
    languageAuto: "自動",
    languageJapanese: "日本語",
    languageEnglish: "英語",
    saveFolderTitle: "保存フォルダー",
    folderNotSelectedTitle: "保存フォルダーが未設定です",
    folderNotSelectedDescription: "画像を保存する前にフォルダーを選択してください。",
    folderReadyTitle: "保存できます",
    folderReadyDescription: "画像はこのフォルダーに保存されます。",
    folderPermissionTitle: "権限が必要です",
    folderPermissionDescription: "保存を続けるには、もう一度フォルダーを選択してください。",
    chooseFolder: "フォルダーを選択",
    chooseAgain: "再選択",
    clearFolder: "クリア",
    fileNamingTitle: "ファイル名",
    filenameTemplateLabel: "ファイル名テンプレート",
    filenameTemplateHint: "利用できる変数: {author}, {tweetId}, {date}, {time}, {originalName}",
    duplicateBehaviorLabel: "重複時の動作",
    duplicateOverwrite: "上書き",
    duplicateSkip: "スキップ",
    duplicateRename: "リネーム",
    preferOriginalImageLabel: "原寸画像を優先する",
    openFullSettings: "詳細設定を開く",
    developerDiagnostics: "開発者向け診断",
    developerDiagnosticsHint: "開発中の確認用にデバッグログを残しています。",
    refreshLogs: "ログを更新",
    clearLogs: "ログを消去",
    noLogs: "ログはありません。",
    folderSaved: "フォルダーを保存しました。",
    folderCleared: "保存フォルダーをクリアしました。",
    folderPermissionNotGranted: "フォルダーの権限が許可されませんでした。",
    folderSelectionCancelled: "フォルダー選択をキャンセルしました。",
    settingsSaved: "設定を保存しました。",
  },
};

export function normalizeLanguageSetting(value: unknown): LanguageSetting {
  return value === "ja" || value === "en" || value === "auto" ? value : "auto";
}

export function resolveLocale(
  languageSetting: LanguageSetting,
  browserLanguage: string | undefined,
): ResolvedLocale {
  if (languageSetting === "ja" || languageSetting === "en") {
    return languageSetting;
  }

  return browserLanguage?.toLowerCase().startsWith("ja") ? "ja" : "en";
}

export function getUiMessages(locale: ResolvedLocale): UiMessages {
  return messages[locale];
}

export function getBrowserLanguage(): string {
  return getChromeUiLanguage() || navigator.language || "en";
}

function getChromeUiLanguage(): string | undefined {
  if (typeof chrome === "undefined") {
    return undefined;
  }

  return chrome.i18n?.getUILanguage?.();
}
