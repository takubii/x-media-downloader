export type XVideoMediaType = "video" | "gif";

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

export function getXVideoKey(videoUrl: string): string {
  const url = new URL(videoUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
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

export function resolveXVideoCandidate(input: {
  videoSrc?: string;
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

  return null;
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
