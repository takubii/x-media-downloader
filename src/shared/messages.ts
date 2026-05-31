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

export type RuntimeMessage =
  | { type: "SAVE_IMAGE"; payload: SaveImagePayload }
  | { type: "SAVE_IMAGE_OFFSCREEN"; payload: SaveImagePayload; target: "offscreen" }
  | { type: "OPEN_OPTIONS" };

