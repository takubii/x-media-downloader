export type XVideoPageCandidate = {
  tweetId?: string;
  mediaId: string;
  videoUrl: string;
  mediaType: "video" | "gif";
  bitrate?: number;
};

type XVideoVariant = {
  url: string;
  bitrate?: number;
};

export function extractXVideoCandidatesFromApiJson(value: unknown): XVideoPageCandidate[] {
  const candidates: XVideoPageCandidate[] = [];

  walkRecords(value, [], (record, ancestors) => {
    const variant = selectBestXVideoVariant(getMp4Variants(record.video_info));

    if (!variant) {
      return;
    }

    const mediaId = getMediaIdFromRecord(record);

    if (!mediaId) {
      return;
    }

    candidates.push({
      tweetId: findTweetId(ancestors),
      mediaId,
      videoUrl: variant.url,
      mediaType: detectXVideoMediaType({
        apiMediaType: getStringValue(record.type),
        videoUrl: variant.url,
      }),
      bitrate: variant.bitrate,
    });
  });

  return dedupeCandidates(candidates);
}

function getMp4Variants(videoInfo: unknown): XVideoVariant[] {
  if (!isRecord(videoInfo) || !Array.isArray(videoInfo.variants)) {
    return [];
  }

  return videoInfo.variants
    .map((variant) => parseMp4Variant(variant))
    .filter((variant): variant is XVideoVariant => Boolean(variant));
}

function parseMp4Variant(value: unknown): XVideoVariant | null {
  if (!isRecord(value) || value.content_type !== "video/mp4") {
    return null;
  }

  const url = getDirectXMp4Url(getStringValue(value.url) || "");

  if (!url) {
    return null;
  }

  return {
    url,
    bitrate: typeof value.bitrate === "number" ? value.bitrate : undefined,
  };
}

function getMediaIdFromRecord(record: Record<string, unknown>): string | null {
  const idString = getStringValue(record.id_str) || getStringValue(record.id);

  if (idString) {
    return idString;
  }

  const mediaKey = getStringValue(record.media_key);
  const mediaKeyId = mediaKey?.match(/^\d+_(.+)$/)?.[1];

  if (mediaKeyId) {
    return mediaKeyId;
  }

  const mediaUrl = getStringValue(record.media_url_https);

  if (mediaUrl) {
    return getXVideoMediaId(mediaUrl);
  }

  const variants = isRecord(record.video_info) ? record.video_info.variants : undefined;

  if (Array.isArray(variants)) {
    for (const variant of variants) {
      if (isRecord(variant)) {
        const mediaId = getXVideoMediaId(getStringValue(variant.url) || "");

        if (mediaId) {
          return mediaId;
        }
      }
    }
  }

  return null;
}

function findTweetId(ancestors: readonly Record<string, unknown>[]): string | undefined {
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const tweetId = getTweetIdFromRecord(ancestors[index]);

    if (tweetId) {
      return tweetId;
    }
  }

  return undefined;
}

function getTweetIdFromRecord(record: Record<string, unknown>): string | undefined {
  const restId = getStringValue(record.rest_id);

  if (restId && isRecord(record.legacy)) {
    return restId;
  }

  const idString = getStringValue(record.id_str);

  if (
    idString &&
    (isRecord(record.entities) ||
      isRecord(record.extended_entities) ||
      typeof record.full_text === "string")
  ) {
    return idString;
  }

  return undefined;
}

function dedupeCandidates(candidates: readonly XVideoPageCandidate[]): XVideoPageCandidate[] {
  const deduped = new Map<string, XVideoPageCandidate>();

  for (const candidate of candidates) {
    deduped.set(`${candidate.tweetId || ""}:${candidate.mediaId}:${candidate.videoUrl}`, candidate);
  }

  return Array.from(deduped.values());
}

function walkRecords(
  value: unknown,
  ancestors: readonly Record<string, unknown>[],
  callback: (
    record: Record<string, unknown>,
    ancestors: readonly Record<string, unknown>[],
  ) => void,
): void {
  if (!value || typeof value !== "object") {
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      walkRecords(item, ancestors, callback);
    }
    return;
  }

  const record = value as Record<string, unknown>;
  callback(record, ancestors);

  for (const child of Object.values(record)) {
    walkRecords(child, [...ancestors, record], callback);
  }
}

function selectBestXVideoVariant(variants: readonly XVideoVariant[]): XVideoVariant | null {
  return (
    variants
      .filter((variant) => getDirectXMp4Url(variant.url))
      .toSorted((left, right) => (right.bitrate || 0) - (left.bitrate || 0))[0] || null
  );
}

function detectXVideoMediaType(input: {
  apiMediaType?: string;
  videoUrl: string;
}): "video" | "gif" {
  if (input.apiMediaType === "animated_gif") {
    return "gif";
  }

  if (input.apiMediaType === "video") {
    return "video";
  }

  return input.videoUrl.includes("/tweet_video/") ? "gif" : "video";
}

function getDirectXMp4Url(value: string): string | null {
  try {
    const url = new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"));

    if (url.hostname !== "video.twimg.com" || !url.pathname.endsWith(".mp4")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getXVideoMediaId(value: string): string | null {
  try {
    const url = new URL(value.replaceAll("\\/", "/").replaceAll("&amp;", "&"));

    if (url.hostname !== "video.twimg.com" && url.hostname !== "pbs.twimg.com") {
      return null;
    }

    return (
      url.pathname.match(
        /\/(?:ext_tw_video|amplify_video|tweet_video_thumb|ext_tw_video_thumb|amplify_video_thumb)\/([^/]+)/,
      )?.[1] ||
      url.pathname.match(/\/tweet_video\/([^/.]+)/)?.[1] ||
      null
    );
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
