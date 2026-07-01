import { getXVideoMediaId } from "./video-target";
import { normalizeXVideoPageCandidate } from "./x-video-response";
import type { XVideoPageCandidate } from "./x-video-response";

export type XVideoStatusInfo = {
  author?: string;
  tweetId?: string;
};

export type XVideoPageCandidateMessage = {
  delivery: "live" | "snapshot";
  requestPath?: string;
  candidates: XVideoPageCandidate[];
};

type MissingXVideoCandidateLog = {
  reason: "missing-media-id" | "missing-candidate";
  tweetId?: string;
  mediaId: string | null;
  posterUrl?: string;
  videoSrc?: string;
  pageUrl: string;
};

type XVideoPageCandidateStore = {
  cache(candidates: readonly XVideoPageCandidate[]): void;
  find(video: HTMLVideoElement, statusInfo: XVideoStatusInfo): XVideoPageCandidate | null;
  markMissing(
    video: HTMLVideoElement,
    statusInfo: XVideoStatusInfo,
  ): MissingXVideoCandidateLog | null;
};

type XVideoPageCandidateStoreOptions = {
  getPageUrl?: () => string;
};

const PAGE_MESSAGE_SOURCE = "x-media-downloader-page";
const PAGE_MESSAGE_TYPE = "X_VIDEO_API_CANDIDATES";
const CONTENT_MESSAGE_SOURCE = "x-media-downloader-content";
const SNAPSHOT_REQUEST_TYPE = "REQUEST_X_VIDEO_API_CANDIDATES";
const MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES = 500;
const MAX_MISSING_VIDEO_LOG_ENTRIES = 500;

export function requestXVideoPageCandidateSnapshot(): void {
  window.postMessage(
    {
      source: CONTENT_MESSAGE_SOURCE,
      type: SNAPSHOT_REQUEST_TYPE,
    },
    location.origin,
  );
}

export function parseXVideoPageCandidateMessage(value: unknown): XVideoPageCandidateMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as {
    source?: unknown;
    type?: unknown;
    delivery?: unknown;
    requestPath?: unknown;
    candidates?: unknown;
  };

  if (
    message.source !== PAGE_MESSAGE_SOURCE ||
    message.type !== PAGE_MESSAGE_TYPE ||
    (message.delivery !== "live" && message.delivery !== "snapshot") ||
    !Array.isArray(message.candidates)
  ) {
    return null;
  }

  const candidates = message.candidates
    .map((candidate) => normalizeXVideoPageCandidate(candidate))
    .filter((candidate): candidate is XVideoPageCandidate => Boolean(candidate));

  if (candidates.length === 0) {
    return null;
  }

  return {
    delivery: message.delivery,
    requestPath: typeof message.requestPath === "string" ? message.requestPath : undefined,
    candidates,
  };
}

export function createXVideoPageCandidateStore(
  options: XVideoPageCandidateStoreOptions = {},
): XVideoPageCandidateStore {
  const candidates = new Map<string, XVideoPageCandidate>();
  const missingLogs = new Set<string>();
  const getPageUrl = options.getPageUrl || (() => location.href);

  return {
    cache(values) {
      for (const value of values) {
        setBoundedMapValue(
          candidates,
          getMediaCacheKey(value.mediaId),
          value,
          MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES,
        );

        if (value.tweetId) {
          setBoundedMapValue(
            candidates,
            getTweetMediaCacheKey(value.tweetId, value.mediaId),
            value,
            MAX_PAGE_VIDEO_CANDIDATE_CACHE_ENTRIES,
          );
        }
      }
    },

    find(video, statusInfo) {
      for (const cacheKey of getVideoResolutionCacheKeys(video, statusInfo)) {
        const candidate = candidates.get(cacheKey);

        if (candidate) {
          return candidate;
        }
      }

      return null;
    },

    markMissing(video, statusInfo) {
      const mediaId = video.poster ? getXVideoMediaId(video.poster) : null;
      const logKey = mediaId
        ? statusInfo.tweetId
          ? getTweetMediaCacheKey(statusInfo.tweetId, mediaId)
          : getMediaCacheKey(mediaId)
        : getMissingMediaIdLogKey(video, statusInfo);

      if (missingLogs.has(logKey)) {
        return null;
      }

      addBoundedSetValue(missingLogs, logKey, MAX_MISSING_VIDEO_LOG_ENTRIES);

      return {
        reason: mediaId ? "missing-candidate" : "missing-media-id",
        tweetId: statusInfo.tweetId,
        mediaId,
        posterUrl: video.poster || undefined,
        videoSrc: video.currentSrc || video.src || undefined,
        pageUrl: getPageUrl(),
      };
    },
  };
}

function getVideoResolutionCacheKeys(
  video: HTMLVideoElement,
  statusInfo: XVideoStatusInfo,
): string[] {
  const mediaId = video.poster ? getXVideoMediaId(video.poster) : null;

  if (!mediaId) {
    return [];
  }

  return [
    ...(statusInfo.tweetId ? [getTweetMediaCacheKey(statusInfo.tweetId, mediaId)] : []),
    getMediaCacheKey(mediaId),
  ];
}

function getTweetMediaCacheKey(tweetId: string, mediaId: string): string {
  return `${tweetId}:${mediaId}`;
}

function getMediaCacheKey(mediaId: string): string {
  return `media:${mediaId}`;
}

function getMissingMediaIdLogKey(video: HTMLVideoElement, statusInfo: XVideoStatusInfo): string {
  return [
    "missing-media-id",
    statusInfo.tweetId || "",
    video.poster || "",
    video.currentSrc || video.src || "",
  ].join(":");
}

function setBoundedMapValue<TKey, TValue>(
  map: Map<TKey, TValue>,
  key: TKey,
  value: TValue,
  maxEntries: number,
): void {
  if (map.has(key)) {
    map.delete(key);
  }

  map.set(key, value);

  while (map.size > maxEntries) {
    const oldestKey = map.keys().next().value as TKey | undefined;

    if (oldestKey === undefined) {
      return;
    }

    map.delete(oldestKey);
  }
}

function addBoundedSetValue<TValue>(set: Set<TValue>, value: TValue, maxEntries: number): void {
  if (set.has(value)) {
    set.delete(value);
  }

  set.add(value);

  while (set.size > maxEntries) {
    const oldestValue = set.values().next().value as TValue | undefined;

    if (oldestValue === undefined) {
      return;
    }

    set.delete(oldestValue);
  }
}
