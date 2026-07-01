import type { ImageMetadata } from "./filename";
import type { SaveVideoPayload } from "./messages";

const VIDEO_HOST = "video.twimg.com";
const VIDEO_MP4_EXTENSION = ".mp4";

export function getVideoMetadata(payload: SaveVideoPayload): ImageMetadata {
  const url = new URL(payload.videoUrl);

  return {
    author: payload.author || "unknown",
    tweetId: payload.tweetId || "unknown",
    originalName: getOriginalName(url),
    ext: payload.mediaType === "gif" ? "gif" : "mp4",
  };
}

export function getVideoKey(videoUrl: string): string {
  const url = new URL(videoUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function isValidSaveVideoPayload(payload: SaveVideoPayload): boolean {
  return (
    (payload.mediaType === "video" || payload.mediaType === "gif") &&
    isXVideoMp4Url(payload.videoUrl)
  );
}

export function isXVideoMp4Url(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === VIDEO_HOST &&
      url.pathname.endsWith(VIDEO_MP4_EXTENSION)
    );
  } catch {
    return false;
  }
}

function getOriginalName(url: URL): string {
  const pathName = url.pathname.split("/").filter(Boolean).at(-1) || "video";
  return pathName.replace(/\.[a-zA-Z0-9]+$/, "") || "video";
}
