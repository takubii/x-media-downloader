export type XVideoMediaType = "video" | "gif";

export type XVideoVariant = {
  url: string;
  bitrate?: number;
};

export type XVideoCandidate = {
  videoUrl: string;
  mediaType: XVideoMediaType;
  bitrate?: number;
};

const VIDEO_HOST = "video.twimg.com";
const VIDEO_MP4_EXTENSION = ".mp4";

export function detectXVideoMediaType(input: {
  apiMediaType?: string;
  videoUrl: string;
}): XVideoMediaType {
  if (input.apiMediaType === "animated_gif") {
    return "gif";
  }

  if (input.apiMediaType === "video") {
    return "video";
  }

  return isTweetVideoUrl(input.videoUrl) ? "gif" : "video";
}

export function getXVideoMediaId(value: string): string | null {
  try {
    const url = new URL(value);

    if (url.hostname !== VIDEO_HOST && url.hostname !== "pbs.twimg.com") {
      return null;
    }

    const match = url.pathname.match(
      /\/(?:ext_tw_video|amplify_video|tweet_video_thumb|ext_tw_video_thumb|amplify_video_thumb)\/([^/]+)/,
    );

    if (match) {
      return match[1];
    }

    return url.pathname.match(/\/tweet_video\/([^/.]+)/)?.[1] || null;
  } catch {
    return null;
  }
}

export function getDirectXMp4Url(value: string): string | null {
  try {
    const url = new URL(normalizeEscapedUrl(value));

    if (url.hostname !== VIDEO_HOST || !url.pathname.endsWith(VIDEO_MP4_EXTENSION)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function parseXVideoVariants(source: string): XVideoVariant[] {
  const variants: XVideoVariant[] = [];
  const objectPattern = /\{[^{}]*video\.twimg\.com[^{}]*\.mp4[^{}]*\}/g;

  for (const match of source.matchAll(objectPattern)) {
    const variant = parseXVideoVariantObject(match[0]);

    if (variant) {
      variants.push(variant);
    }
  }

  return variants;
}

export function selectBestXVideoVariant(variants: readonly XVideoVariant[]): XVideoVariant | null {
  return (
    variants
      .filter((variant) => getDirectXMp4Url(variant.url))
      .toSorted((left, right) => (right.bitrate || 0) - (left.bitrate || 0))[0] || null
  );
}

export function resolveXVideoCandidate(input: {
  videoSrc?: string;
  posterUrl?: string;
  sourceText?: string;
  apiMediaType?: string;
}): XVideoCandidate | null {
  const directUrl = input.videoSrc ? getDirectXMp4Url(input.videoSrc) : null;

  if (directUrl) {
    return {
      videoUrl: directUrl,
      mediaType: detectXVideoMediaType({
        apiMediaType: input.apiMediaType,
        videoUrl: directUrl,
      }),
    };
  }

  const mediaId =
    (input.videoSrc ? getXVideoMediaId(input.videoSrc) : null) ||
    (input.posterUrl ? getXVideoMediaId(input.posterUrl) : null);

  if (!mediaId || !input.sourceText) {
    return null;
  }

  const variant = selectBestXVideoVariant(
    parseXVideoVariants(input.sourceText).filter(
      (candidate) => getXVideoMediaId(candidate.url) === mediaId,
    ),
  );

  if (!variant) {
    return null;
  }

  return {
    videoUrl: variant.url,
    mediaType: detectXVideoMediaType({
      apiMediaType: input.apiMediaType,
      videoUrl: variant.url,
    }),
    bitrate: variant.bitrate,
  };
}

function isTweetVideoUrl(videoUrl: string): boolean {
  try {
    const url = new URL(videoUrl);
    return url.hostname === VIDEO_HOST && url.pathname.includes("/tweet_video/");
  } catch {
    return false;
  }
}

function normalizeEscapedUrl(value: string): string {
  return value.replaceAll("\\/", "/").replaceAll("&amp;", "&");
}

function parseXVideoVariantObject(source: string): XVideoVariant | null {
  if (!hasFieldValue(source, "content_type", "video/mp4")) {
    return null;
  }

  const rawUrl = getStringFieldValue(source, "url");
  const url = rawUrl ? getDirectXMp4Url(rawUrl) : null;

  if (!url) {
    return null;
  }

  return {
    url,
    bitrate: getNumberFieldValue(source, "bitrate"),
  };
}

function hasFieldValue(source: string, fieldName: string, expectedValue: string): boolean {
  const value = getStringFieldValue(source, fieldName);
  return value === expectedValue;
}

function getStringFieldValue(source: string, fieldName: string): string | undefined {
  const match = source.match(getFieldPattern(fieldName, '"([^"]+)"'));
  return match?.[1];
}

function getNumberFieldValue(source: string, fieldName: string): number | undefined {
  const match = source.match(getFieldPattern(fieldName, "(\\d+)"));
  return match ? Number(match[1]) : undefined;
}

function getFieldPattern(fieldName: string, valuePattern: string): RegExp {
  return new RegExp(`"?${fieldName}"?\\s*:\\s*${valuePattern}`);
}
