import type { Settings } from "./settings";
import type { MediaType } from "./media-type";

export type SaveImagePayload = {
  imageUrl: string;
  pageUrl: string;
  mediaType?: MediaType;
  author?: string;
  tweetId?: string;
};

export type SaveVideoPayload = {
  videoUrl: string;
  pageUrl: string;
  mediaType: "video" | "gif";
  posterUrl?: string;
  bitrate?: number;
  author?: string;
  tweetId?: string;
};

type SaveFailureReason = "folder-not-selected" | "permission-denied" | "download-failed";

export type SaveMediaResponse =
  | { ok: true; filename: string; skipped?: boolean }
  | { ok: false; error: string; reason?: SaveFailureReason };

export type SaveImageResponse = SaveMediaResponse;
export type SaveVideoResponse = SaveMediaResponse;

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
  | { type: "SAVE_VIDEO"; payload: SaveVideoPayload }
  | {
      type: "SAVE_IMAGE_OFFSCREEN";
      payload: SaveImagePayload;
      settings: Settings;
      target: "offscreen";
    }
  | {
      type: "SAVE_VIDEO_OFFSCREEN";
      payload: SaveVideoPayload;
      settings: Settings;
      target: "offscreen";
    }
  | { type: "OPEN_OPTIONS" }
  | { type: "DEBUG_LOG"; entry: DebugLogEntry };
