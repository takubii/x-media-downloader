import type { Settings } from "./settings";

export type SaveImagePayload = {
  imageUrl: string;
  pageUrl: string;
  author?: string;
  tweetId?: string;
};

export type SaveFailureReason =
  | "folder-not-selected"
  | "permission-denied"
  | "download-failed";

export type SaveImageResponse =
  | { ok: true; filename: string; skipped?: boolean }
  | { ok: false; error: string; reason?: SaveFailureReason };

export type DebugLogSource = "content" | "background" | "offscreen" | "options";
export type DebugLogLevel = "debug" | "info" | "warn" | "error";

export type DebugLogEntry = {
  timestamp: string;
  source: DebugLogSource;
  level: DebugLogLevel;
  message: string;
  details?: string;
};

export type RuntimeMessage =
  | { type: "SAVE_IMAGE"; payload: SaveImagePayload }
  | {
      type: "SAVE_IMAGE_OFFSCREEN";
      payload: SaveImagePayload;
      settings: Settings;
      target: "offscreen";
    }
  | { type: "OPEN_OPTIONS" }
  | { type: "DEBUG_LOG"; entry: DebugLogEntry };
