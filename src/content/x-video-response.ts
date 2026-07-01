import { getDirectXMp4Url, getXVideoMediaId } from "./video-target";
import type { XVideoMediaType } from "./video-target";

export type XVideoPageCandidate = {
  tweetId?: string;
  mediaId: string;
  videoUrl: string;
  mediaType: XVideoMediaType;
  bitrate?: number;
};

const MAX_ID_LENGTH = 80;
const X_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function normalizeXVideoPageCandidate(value: unknown): XVideoPageCandidate | null {
  if (!isRecord(value)) {
    return null;
  }

  const mediaId = getStringValue(value.mediaId);
  const videoUrl = getDirectXMp4Url(getStringValue(value.videoUrl) || "");
  const mediaType = value.mediaType;

  if (
    !mediaId ||
    !isValidXId(mediaId) ||
    !videoUrl ||
    getXVideoMediaId(videoUrl) !== mediaId ||
    (mediaType !== "video" && mediaType !== "gif")
  ) {
    return null;
  }

  const tweetId = getStringValue(value.tweetId);
  const bitrate = value.bitrate;

  if (tweetId && (!isValidXId(tweetId) || !/^\d+$/.test(tweetId))) {
    return null;
  }

  if (bitrate !== undefined && (typeof bitrate !== "number" || !Number.isFinite(bitrate))) {
    return null;
  }

  return {
    tweetId,
    mediaId,
    videoUrl,
    mediaType,
    bitrate,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function isValidXId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_ID_LENGTH && X_ID_PATTERN.test(value);
}
